import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { createApp } from "../src/app.js";
import { JobModel } from "../src/models/Job.js";
import { MeetingModel } from "../src/models/Meeting.js";
import { claimJob } from "../src/services/jobs.js";
import { emptyNotes } from "../src/services/notes/schema.js";
import { runSummarize } from "../src/services/processing.js";
import { ensureStorageRoot } from "../src/services/storage.js";

const app = createApp();
const WORKER = { "X-Worker-Token": "test-worker-token-123456" };
const fakeAudio = Buffer.from("OggS fake webm opus bytes");

async function signUp(email: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/register").send({ name: "Test User", email, password: "password123" });
  expect(res.status).toBe(201);
  return agent;
}

beforeAll(async () => {
  await ensureStorageRoot();
  await mongoose.connect(inject("mongoUri"));
  await mongoose.connection.dropDatabase();
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe("auth", () => {
  it("rejects unauthenticated access and bad credentials", async () => {
    expect((await request(app).get("/api/meetings")).status).toBe(401);
    await signUp("auth@test.dev");
    const bad = await request(app).post("/api/auth/login").send({ email: "auth@test.dev", password: "wrongpass1" });
    expect(bad.status).toBe(401);
  });

  it("issues a bearer token for the extension", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "auth@test.dev", password: "password123", client: "extension" });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${res.body.token}`);
    expect(me.body.user.email).toBe("auth@test.dev");
  });
});

describe("recording → transcription → notes pipeline", () => {
  let agent: Awaited<ReturnType<typeof signUp>>;
  let meetingId: string;

  beforeAll(async () => {
    agent = await signUp("pipeline@test.dev");
  });

  it("requires participant consent to start recording", async () => {
    const res = await agent.post("/api/meetings").send({ title: "No consent" });
    expect(res.status).toBe(400);
  });

  it("records chunks idempotently and finishes", async () => {
    const created = await agent
      .post("/api/meetings")
      .send({ title: "Sprint planning", meetingUrl: "https://meet.google.com/abc-defg-hij", consentConfirmed: true });
    expect(created.status).toBe(201);
    meetingId = created.body.meeting.id;

    for (const [index, start] of [[0, 0], [1, 300], [1, 300]] as const) {
      const up = await agent
        .put(`/api/meetings/${meetingId}/chunks/${index}`)
        .field("startTime", String(start))
        .field("endTime", String(start + 300))
        .attach("audio", fakeAudio, { filename: "c.webm", contentType: "audio/webm" });
      expect(up.status).toBe(201);
    }

    const fin = await agent.post(`/api/meetings/${meetingId}/finish`).send({ totalChunks: 3 });
    expect(fin.status).toBe(200);
    expect(fin.body.meeting).toMatchObject({ status: "processing", missingChunks: [2], duration: 600 });
    expect(await JobModel.countDocuments({ meetingId, type: "transcribe" })).toBe(1);
  });

  it("lets the worker transcribe, retry failed chunks and complete", async () => {
    expect((await request(app).post("/api/internal/jobs/claim").send({ workerId: "w" })).status).toBe(401);

    const claim = await request(app).post("/api/internal/jobs/claim").set(WORKER).send({ workerId: "py-1" });
    expect(claim.status).toBe(200);
    expect(claim.body.chunks.map((c: { index: number }) => c.index)).toEqual([0, 1]);
    const jobId = claim.body.job.id;

    const put = (index: number, text: string, start: number) =>
      request(app)
        .put(`/api/internal/jobs/${jobId}/chunks/${index}/transcript`)
        .set(WORKER)
        .send({ segments: [{ startTime: start, endTime: start + 5, speaker: "Cameron", text }] });

    expect((await put(0, "Cameron will audit the Shadcn components.", 3)).status).toBe(204);
    const failed = await request(app)
      .post(`/api/internal/jobs/${jobId}/chunks/1/failed`)
      .set(WORKER)
      .send({ error: "decode error" });
    expect(failed.body.retry).toBe(true);
    expect((await put(1, "We decided to launch on Friday.", 305)).status).toBe(204);
    // Re-sending is idempotent.
    expect((await put(1, "We decided to launch on Friday.", 305)).status).toBe(204);

    expect((await request(app).post(`/api/internal/jobs/${jobId}/complete`).set(WORKER).send()).status).toBe(204);
    const meeting = await MeetingModel.findById(meetingId);
    expect(meeting?.processingStage).toBe("summarizing");
  });

  it("generates grounded notes and exposes them", async () => {
    const job = await claimJob(["summarize"], "test");
    expect(job).not.toBeNull();
    await runSummarize(job!, async () => ({
      ...emptyNotes(),
      executiveSummary: "Audit planned, launch Friday.",
      decisions: [{ description: "Launch on Friday", timestamp: 305 }],
      actionItems: [
        { task: "Audit Shadcn components", assignedTo: "Cameron", deadlineText: "", deadline: "", timestamp: 3, uncertain: false },
        { task: "Write release notes", assignedTo: "Morgan", deadlineText: "", deadline: "", timestamp: 4, uncertain: false },
      ],
    }));

    const detail = await agent.get(`/api/meetings/${meetingId}`);
    expect(detail.body.meeting.status).toBe("completed");
    expect(detail.body.transcript.segments).toHaveLength(2);
    expect(detail.body.transcript.status).toBe("partial"); // chunk 2 never arrived
    const [audit, release] = detail.body.notes.actionItems;
    expect(audit.assignedTo).toBe("Cameron");
    expect(release).toMatchObject({ assignedTo: "", uncertain: true }); // "Morgan" never spoke

    const list = await agent.get("/api/meetings").query({ q: "Shadcn", searchTranscript: "true" });
    expect(list.body.items[0]).toMatchObject({ id: meetingId, actionItemCount: 2 });

    const search = await agent.get("/api/search").query({ q: "Friday" });
    expect(search.body.results[0].moments[0].startTime).toBe(305);
  });

  it("supports task management and exports", async () => {
    const detail = await agent.get(`/api/meetings/${meetingId}`);
    const itemId = detail.body.notes.actionItems[1]._id;
    const patched = await agent
      .patch(`/api/meetings/${meetingId}/action-items/${itemId}`)
      .send({ status: "done", assignedTo: "Kristin", deadline: "2026-05-28" });
    expect(patched.body.item).toMatchObject({ status: "done", assignedTo: "Kristin", uncertain: false });

    const added = await agent.post(`/api/meetings/${meetingId}/action-items`).send({ task: "Book retro" });
    expect(added.status).toBe(201);

    const md = await agent.get(`/api/meetings/${meetingId}/export`).query({ format: "md" });
    expect(md.headers["content-type"]).toContain("text/markdown");
    expect(md.text).toContain("- [x] Write release notes — Kristin (due 2026-05-28)");

    const pdf = await agent.get(`/api/meetings/${meetingId}/export`).query({ format: "pdf" }).buffer(true);
    expect(pdf.headers["content-type"]).toBe("application/pdf");

    const audio = await agent.get(`/api/meetings/${meetingId}/audio/0`);
    expect(audio.status).toBe(200);
  });

  it("isolates meetings between users", async () => {
    const other = await signUp("other@test.dev");
    expect((await other.get(`/api/meetings/${meetingId}`)).status).toBe(404);
    expect((await other.get(`/api/meetings/${meetingId}/audio/0`)).status).toBe(404);
    expect((await other.delete(`/api/meetings/${meetingId}`)).status).toBe(404);
    expect((await other.get("/api/meetings/not-an-id")).status).toBe(404);
  });

  it("deletes a meeting with its audio", async () => {
    expect((await agent.delete(`/api/meetings/${meetingId}`)).status).toBe(204);
    expect((await agent.get(`/api/meetings/${meetingId}`)).status).toBe(404);
  });
});
