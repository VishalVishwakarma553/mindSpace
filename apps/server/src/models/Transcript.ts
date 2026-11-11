import { Schema, model, type InferSchemaType } from "mongoose";
import { segmentSchema } from "./AudioChunk.js";

const transcriptSchema = new Schema(
  {
    meetingId: { type: Schema.Types.ObjectId, ref: "Meeting", required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    segments: { type: [segmentSchema], default: [] },
    language: { type: String, default: "en" },
    status: { type: String, enum: ["partial", "complete"], default: "complete" },
  },
  { timestamps: true },
);

transcriptSchema.index({ "segments.text": "text" });

export type Transcript = InferSchemaType<typeof transcriptSchema>;
export type TranscriptSegment = Transcript["segments"][number];
export const TranscriptModel = model("Transcript", transcriptSchema);
