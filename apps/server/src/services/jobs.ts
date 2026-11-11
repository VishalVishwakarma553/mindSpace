import type { Types } from "mongoose";
import { JobModel, type JobDoc, type JobType } from "../models/Job.js";

const LEASE_MS = 10 * 60 * 1000;

/** Create a job unless an active one already exists for this meeting (prevents duplicate transcripts). */
export async function enqueueJob(
  type: JobType,
  meetingId: Types.ObjectId | string,
  userId: Types.ObjectId | string,
): Promise<JobDoc> {
  const active = await JobModel.findOne({ type, meetingId, status: { $in: ["queued", "running"] } });
  if (active) return active;
  return JobModel.create({ type, meetingId, userId });
}

/**
 * Atomically claim the oldest runnable job. Running jobs whose lease expired
 * (crashed worker) are reclaimable, which gives at-least-once processing.
 */
export async function claimJob(types: JobType[], workerId: string): Promise<JobDoc | null> {
  const now = new Date();
  return JobModel.findOneAndUpdate(
    {
      type: { $in: types },
      $expr: { $lt: ["$attempts", "$maxAttempts"] },
      $or: [
        { status: "queued", runAfter: { $lte: now } },
        { status: "running", lockedUntil: { $lt: now } },
      ],
    },
    {
      $set: { status: "running", workerId, lockedUntil: new Date(now.getTime() + LEASE_MS) },
      $inc: { attempts: 1 },
    },
    { sort: { createdAt: 1 }, returnDocument: "after" },
  );
}

export async function extendLease(jobId: string): Promise<void> {
  await JobModel.updateOne(
    { _id: jobId, status: "running" },
    { $set: { lockedUntil: new Date(Date.now() + LEASE_MS) } },
  );
}

export async function completeJob(jobId: Types.ObjectId | string): Promise<void> {
  await JobModel.updateOne({ _id: jobId }, { $set: { status: "completed", lockedUntil: null, lastError: "" } });
}

/** Re-queue with exponential backoff, or fail permanently. Returns true when the job is terminally failed. */
export async function failJob(job: JobDoc, error: string, retryable = true): Promise<boolean> {
  const terminal = !retryable || job.attempts >= job.maxAttempts;
  const backoffMs = Math.min(5 * 60_000, 15_000 * 2 ** Math.max(0, job.attempts - 1));
  await JobModel.updateOne(
    { _id: job._id },
    {
      $set: {
        status: terminal ? "failed" : "queued",
        lastError: error.slice(0, 1000),
        lockedUntil: null,
        runAfter: new Date(Date.now() + (terminal ? 0 : backoffMs)),
      },
    },
  );
  return terminal;
}

/** Jobs whose worker died on the final attempt can never be reclaimed; surface them as failed. */
export async function findAbandonedJobs(): Promise<JobDoc[]> {
  return JobModel.find({
    status: "running",
    lockedUntil: { $lt: new Date() },
    $expr: { $gte: ["$attempts", "$maxAttempts"] },
  });
}
