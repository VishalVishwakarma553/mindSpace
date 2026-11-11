import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

export const JOB_TYPES = ["transcribe", "summarize"] as const;
export type JobType = (typeof JOB_TYPES)[number];

const jobSchema = new Schema(
  {
    type: { type: String, enum: JOB_TYPES, required: true },
    meetingId: { type: Schema.Types.ObjectId, ref: "Meeting", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["queued", "running", "completed", "failed"],
      default: "queued",
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    lockedUntil: { type: Date, default: null }, // lease; expired leases are reclaimable
    workerId: { type: String, default: "" },
    lastError: { type: String, default: "" },
    runAfter: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

jobSchema.index({ type: 1, status: 1, runAfter: 1 });

export type Job = InferSchemaType<typeof jobSchema>;
export type JobDoc = HydratedDocument<Job>;
export const JobModel = model("Job", jobSchema);
