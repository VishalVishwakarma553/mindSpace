import fs from "node:fs/promises";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { AudioChunkModel } from "../models/AudioChunk.js";
import { JobModel, type JobDoc } from "../models/Job.js";
import { MeetingModel, type MeetingDoc } from "../models/Meeting.js";
import { MeetingNotesModel } from "../models/MeetingNotes.js";
import { TranscriptModel } from "../models/Transcript.js";
import { UserModel } from "../models/User.js";
import { claimJob, completeJob, enqueueJob, failJob, findAbandonedJobs } from "./jobs.js";
import { generateNotes } from "./notes/generator.js";
import { ollamaJsonLlm, type JsonLlm } from "./notes/ollama.js";
import { publish } from "./realtime.js";

const HEARTBEAT_TIMEOUT_MS = 10 * 60 * 1000;

export function meetingEvent(meeting: MeetingDoc) {
  publish(meeting.userId.toString(), {
    type: "meeting.updated",
    meetingId: meeting._id.toString(),
    data: {
      status: meeting.status,
      processingStage: meeting.processingStage,
      processingError: meeting.processingError,
      progress: meeting.progress,
      duration: meeting.duration,
    },
  });
}

async function save(meeting: MeetingDoc) {
  await meeting.save();
  meetingEvent(meeting);
}

/** Kick off (or resume) the pipeline. Already transcribed chunks are never redone. */
export async function startProcessing(meeting: MeetingDoc): Promise<void> {
  const chunks = await AudioChunkModel.find({ meetingId: meeting._id }).select("status").lean();
  if (chunks.length === 0) {
    meeting.status = "failed";
    meeting.processingStage = "failed";
    meeting.processingError = "No audio was captured for this meeting.";
    await save(meeting);
    return;
  }
  // Reset permanently failed chunks so they get another round of retries.
  await AudioChunkModel.updateMany(
    { meetingId: meeting._id, status: "failed" },
    { $set: { status: "pending", attempts: 0, lastError: "" } },
  );
  const done = chunks.filter((c) => c.status === "transcribed").length;
  meeting.status = "processing";
  meeting.processingError = "";
  meeting.progress = { done, total: chunks.length };

  if (done === chunks.length) {
    await finalizeTranscription(meeting);
    return;
  }
  meeting.processingStage = "queued";
  await save(meeting);
  await enqueueJob("transcribe", meeting._id, meeting.userId);
}

/** Re-run only the summarization stage (e.g. after switching models or editing the transcript). */
export async function resummarize(meeting: MeetingDoc): Promise<void> {
  meeting.status = "processing";
  meeting.processingStage = "summarizing";
  meeting.processingError = "";
  meeting.progress = { done: 0, total: 1 };
  await save(meeting);
  await enqueueJob("summarize", meeting._id, meeting.userId);
}

/** Merge per-chunk transcripts, in chunk order, into the meeting transcript and queue summarization. */
export async function finalizeTranscription(meeting: MeetingDoc): Promise<void> {
  const chunks = await AudioChunkModel.find({ meetingId: meeting._id })
    .sort({ chunkIndex: 1 })
    .select("segments language status")
    .lean();
  const segments = chunks
    .flatMap((c) => c.segments)
    .filter((s) => s.text.trim())
    .sort((a, b) => a.startTime - b.startTime);
  const language = chunks.find((c) => c.language)?.language || "en";
  const complete = chunks.every((c) => c.status === "transcribed");

  await TranscriptModel.findOneAndUpdate(
    { meetingId: meeting._id },
    {
      $set: {
        userId: meeting.userId,
        segments,
        language,
        status: complete && meeting.missingChunks.length === 0 ? "complete" : "partial",
      },
    },
    { upsert: true },
  );
  await resummarize(meeting);
}

export async function failMeeting(meetingId: string, error: string): Promise<void> {
  const meeting = await MeetingModel.findById(meetingId);
  if (!meeting) return;
  meeting.status = "failed";
  meeting.processingStage = "failed";
  meeting.processingError = error.slice(0, 500);
  await save(meeting);
}

/** Summarize a meeting's transcript into structured notes. Exported for tests (llm is injectable). */
export async function runSummarize(job: JobDoc, llmOverride?: JsonLlm): Promise<void> {
  const meeting = await MeetingModel.findById(job.meetingId);
  if (!meeting) return completeJob(job._id);
  const [transcript, user] = await Promise.all([
    TranscriptModel.findOne({ meetingId: meeting._id }).lean(),
    UserModel.findById(meeting.userId).lean(),
  ]);
  const model = user?.preferences?.summarizationModel || env.OLLAMA_MODEL;

  const notes = await generateNotes({
    segments: transcript?.segments ?? [],
    meetingTitle: meeting.title,
    llm: llmOverride ?? ollamaJsonLlm(model),
    onProgress: (done, total) => {
      meeting.progress = { done, total };
      meetingEvent(meeting);
    },
  });

  // Keep user-authored tasks and the completion state of tasks the user already checked off.
  const previous = await MeetingNotesModel.findOne({ meetingId: meeting._id }).lean();
  const userItems = previous?.actionItems.filter((a) => a.source === "user") ?? [];
  const doneTasks = new Set(
    previous?.actionItems.filter((a) => a.status === "done").map((a) => a.task.toLowerCase()) ?? [],
  );

  await MeetingNotesModel.findOneAndUpdate(
    { meetingId: meeting._id },
    {
      $set: {
        userId: meeting.userId,
        ...notes,
        overview: notes.objective,
        actionItems: [
          ...notes.actionItems.map((a) => ({
            ...a,
            deadline: a.deadline ? new Date(a.deadline) : null,
            status: doneTasks.has(a.task.toLowerCase()) ? "done" : "open",
            source: "ai",
          })),
          ...userItems,
        ],
        model,
        editedByUser: false,
      },
    },
    { upsert: true },
  );

  if (user?.preferences?.deleteAudioAfterProcessing) {
    const chunks = await AudioChunkModel.find({ meetingId: meeting._id }).select("filePath").lean();
    await Promise.all(chunks.map((c) => fs.rm(c.filePath, { force: true })));
    meeting.audioDeleted = true;
  }

  meeting.status = "completed";
  meeting.processingStage = "done";
  meeting.processingError = "";
  await save(meeting);
  await completeJob(job._id);
}

/** In-process runner for summarize jobs. Concurrency 1 keeps CPU/RAM use predictable (PRD §8.1). */
export function startSummarizeRunner(pollMs = 3000): () => void {
  let busy = false;
  const workerId = `node-${process.pid}`;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      let job: JobDoc | null;
      while ((job = await claimJob(["summarize"], workerId))) {
        try {
          await runSummarize(job);
        } catch (err) {
          const message = (err as Error).message;
          logger.warn({ err, jobId: job._id }, "Summarize job failed");
          const unavailable = (err as Error).name === "LlmUnavailableError";
          if (await failJob(job, message, !unavailable)) await failMeeting(job.meetingId.toString(), message);
        }
      }
    } catch (err) {
      logger.error({ err }, "Summarize runner error");
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(tick, pollMs);
  void tick();
  return () => clearInterval(timer);
}

/** Detect closed tabs / crashed browsers and dead workers (PRD §8.3 reliability). */
export function startSweeper(intervalMs = 60_000): () => void {
  const sweep = async () => {
    try {
      const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS);
      const stale = await MeetingModel.find({
        status: { $in: ["recording", "paused"] },
        lastHeartbeatAt: { $lt: cutoff },
      });
      for (const meeting of stale) {
        meeting.status = "interrupted";
        meeting.processingError = "Recording stopped unexpectedly. Saved audio can still be processed.";
        await save(meeting);
      }
      for (const job of await findAbandonedJobs()) {
        await JobModel.updateOne({ _id: job._id }, { $set: { status: "failed" } });
        await failMeeting(job.meetingId.toString(), job.lastError || "Processing worker stopped responding.");
      }
    } catch (err) {
      logger.error({ err }, "Sweeper error");
    }
  };
  const timer = setInterval(sweep, intervalMs);
  return () => clearInterval(timer);
}
