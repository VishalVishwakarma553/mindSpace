import { Router } from "express";
import { z } from "zod";
import { notFound } from "../lib/errors.js";
import { objectId, parse } from "../lib/validate.js";
import { AudioChunkModel, type AudioChunk } from "../models/AudioChunk.js";
import { JobModel } from "../models/Job.js";
import { MeetingModel } from "../models/Meeting.js";
import { UserModel } from "../models/User.js";
import { claimJob, completeJob, extendLease, failJob } from "../services/jobs.js";
import { failMeeting, finalizeTranscription, meetingEvent } from "../services/processing.js";

/**
 * API for the local Python transcription worker (header X-Worker-Token).
 * The worker runs on the same machine and reads chunk files from the shared storage dir.
 */
export const internalRouter = Router();

let workerLastSeen: { at: Date; workerId: string } | null = null;
export const workerStatus = () => workerLastSeen;

const MAX_CHUNK_ATTEMPTS = 3;

async function runningJob(jobIdParam: unknown) {
  const job = await JobModel.findById(objectId(jobIdParam, "Job"));
  if (!job || job.status !== "running") throw notFound("Running job");
  return job;
}

internalRouter.post("/jobs/claim", async (req, res) => {
  const { workerId } = parse(z.object({ workerId: z.string().min(1).max(100) }), req.body);
  workerLastSeen = { at: new Date(), workerId };

  const job = await claimJob(["transcribe"], workerId);
  if (!job) {
    res.status(204).end();
    return;
  }
  const meeting = await MeetingModel.findById(job.meetingId);
  if (!meeting) {
    await completeJob(job._id);
    res.status(204).end();
    return;
  }
  const user = await UserModel.findById(meeting.userId).lean();
  const chunks = await AudioChunkModel.find({ meetingId: meeting._id, status: { $ne: "transcribed" } })
    .sort({ chunkIndex: 1 })
    .select("chunkIndex filePath startTime endTime attempts")
    .lean();

  meeting.processingStage = "transcribing";
  await meeting.save();
  meetingEvent(meeting);

  res.json({
    job: { id: job._id.toString(), attempt: job.attempts },
    meeting: { id: meeting._id.toString(), title: meeting.title },
    model: user?.preferences?.transcriptionModel ?? "small.en",
    language: "en",
    chunks: chunks.map((c) => ({
      index: c.chunkIndex,
      filePath: c.filePath,
      startTime: c.startTime,
      endTime: c.endTime,
    })),
  });
});

internalRouter.post("/jobs/:jobId/heartbeat", async (req, res) => {
  await extendLease(objectId(req.params.jobId, "Job"));
  res.status(204).end();
});

const segmentsSchema = z.object({
  language: z.string().max(10).default("en"),
  segments: z
    .array(
      z.object({
        startTime: z.number().min(0),
        endTime: z.number().min(0),
        speaker: z.string().max(80).default(""),
        text: z.string().max(10_000),
      }),
    )
    .max(20_000),
});

/** Store one chunk's transcript. Idempotent, so a retried worker never duplicates text. */
internalRouter.put("/jobs/:jobId/chunks/:index/transcript", async (req, res) => {
  const job = await runningJob(req.params.jobId);
  const index = parse(z.coerce.number().int().min(0), req.params.index);
  const body = parse(segmentsSchema, req.body);
  const chunk = await AudioChunkModel.findOneAndUpdate(
    { meetingId: job.meetingId, chunkIndex: index },
    { $set: { segments: body.segments, language: body.language, status: "transcribed", lastError: "" } },
    { returnDocument: "after" },
  );
  if (!chunk) throw notFound("Chunk");
  await extendLease(job._id.toString());

  const meeting = await MeetingModel.findById(job.meetingId);
  if (meeting) {
    const done = await AudioChunkModel.countDocuments({ meetingId: meeting._id, status: "transcribed" });
    meeting.progress = { done, total: meeting.progress?.total || done };
    await meeting.save();
    meetingEvent(meeting);
  }
  res.status(204).end();
});

internalRouter.post("/jobs/:jobId/chunks/:index/failed", async (req, res) => {
  const job = await runningJob(req.params.jobId);
  const index = parse(z.coerce.number().int().min(0), req.params.index);
  const { error } = parse(z.object({ error: z.string().max(2000) }), req.body);
  const chunk = await AudioChunkModel.findOneAndUpdate(
    { meetingId: job.meetingId, chunkIndex: index },
    { $inc: { attempts: 1 }, $set: { lastError: error } },
    { returnDocument: "after" },
  );
  if (!chunk) throw notFound("Chunk");
  const giveUp = chunk.attempts >= MAX_CHUNK_ATTEMPTS;
  if (giveUp) await AudioChunkModel.updateOne({ _id: chunk._id }, { $set: { status: "failed" } });
  res.json({ retry: !giveUp });
});

/**
 * Worker finished all chunks it could. If some chunks failed permanently the meeting is still
 * summarized from the chunks that worked (no completed work is lost), and the gap is reported.
 */
internalRouter.post("/jobs/:jobId/complete", async (req, res) => {
  const job = await runningJob(req.params.jobId);
  const meeting = await MeetingModel.findById(job.meetingId);
  await completeJob(job._id);
  if (!meeting) {
    res.status(204).end();
    return;
  }
  const chunks: Pick<AudioChunk, "status" | "chunkIndex">[] = await AudioChunkModel.find({ meetingId: meeting._id })
    .select("status chunkIndex")
    .lean();
  const pending = chunks.filter((c) => c.status === "pending");
  if (pending.length) {
    // Worker skipped chunks (e.g. crashed mid-run); queue another pass.
    await JobModel.create({ type: "transcribe", meetingId: meeting._id, userId: meeting.userId });
    res.status(202).json({ requeued: pending.map((c) => c.chunkIndex) });
    return;
  }
  const transcribed = chunks.filter((c) => c.status === "transcribed").length;
  if (transcribed === 0) {
    await failMeeting(meeting._id.toString(), "Transcription failed for every audio chunk.");
    res.status(204).end();
    return;
  }
  const failed = chunks.filter((c) => c.status === "failed").map((c) => c.chunkIndex);
  if (failed.length) meeting.missingChunks = [...new Set([...meeting.missingChunks, ...failed])];
  await finalizeTranscription(meeting);
  res.status(204).end();
});

internalRouter.post("/jobs/:jobId/fail", async (req, res) => {
  const job = await runningJob(req.params.jobId);
  const { error, retryable } = parse(
    z.object({ error: z.string().max(2000), retryable: z.boolean().default(true) }),
    req.body,
  );
  if (await failJob(job, error, retryable)) await failMeeting(job.meetingId.toString(), error);
  res.status(204).end();
});
