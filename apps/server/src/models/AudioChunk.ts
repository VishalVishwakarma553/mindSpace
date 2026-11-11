import { Schema, model, type InferSchemaType } from "mongoose";

export const segmentSchema = new Schema(
  {
    startTime: { type: Number, required: true }, // seconds from meeting start
    endTime: { type: Number, required: true },
    speaker: { type: String, default: "" },
    text: { type: String, required: true },
  },
  { _id: false },
);

const audioChunkSchema = new Schema(
  {
    meetingId: { type: Schema.Types.ObjectId, ref: "Meeting", required: true },
    chunkIndex: { type: Number, required: true, min: 0 },
    filePath: { type: String, required: true }, // absolute, never exposed to clients
    mimeType: { type: String, default: "audio/webm" },
    startTime: { type: Number, required: true },
    endTime: { type: Number, required: true },
    duration: { type: Number, required: true },
    fileSize: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "transcribed", "failed"],
      default: "pending",
    },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: "" },
    /** Per-chunk transcript kept so retries never redo completed chunks (PRD §6.3). */
    segments: { type: [segmentSchema], default: [] },
    language: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

audioChunkSchema.index({ meetingId: 1, chunkIndex: 1 }, { unique: true });

export type AudioChunk = InferSchemaType<typeof audioChunkSchema>;
export const AudioChunkModel = model("AudioChunk", audioChunkSchema);
