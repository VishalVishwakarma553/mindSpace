import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

/** Lifecycle of the recording itself (PRD §5.2 recording states). */
export const MEETING_STATUSES = [
  "recording",
  "paused",
  "interrupted",
  "processing",
  "completed",
  "failed",
] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

/** Stage of the post-recording AI pipeline. */
export const PROCESSING_STAGES = ["none", "queued", "transcribing", "summarizing", "done", "failed"] as const;
export type ProcessingStage = (typeof PROCESSING_STAGES)[number];

const meetingSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    platform: { type: String, enum: ["google_meet", "other"], default: "google_meet" },
    meetingUrl: { type: String, default: "" },
    tags: { type: [String], default: [] },
    participants: { type: [String], default: [] },

    status: { type: String, enum: MEETING_STATUSES, default: "recording", index: true },
    processingStage: { type: String, enum: PROCESSING_STAGES, default: "none" },
    processingError: { type: String, default: "" },
    progress: {
      done: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },

    startedAt: { type: Date, required: true },
    endedAt: { type: Date },
    duration: { type: Number, default: 0 }, // seconds of captured audio
    lastHeartbeatAt: { type: Date },

    captureMicrophone: { type: Boolean, default: false },
    consentConfirmed: { type: Boolean, required: true },
    expectedChunks: { type: Number, default: 0 },
    missingChunks: { type: [Number], default: [] },
    audioDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

meetingSchema.index({ userId: 1, startedAt: -1 });
meetingSchema.index({ title: "text" });

export type Meeting = InferSchemaType<typeof meetingSchema>;
export type MeetingDoc = HydratedDocument<Meeting>;
export const MeetingModel = model("Meeting", meetingSchema);
