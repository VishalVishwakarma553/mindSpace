import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

export const TRANSCRIPTION_MODELS = ["tiny.en", "base.en", "small.en", "medium.en", "large-v3"] as const;
export const STORAGE_MODES = ["local"] as const;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    preferences: {
      transcriptionModel: { type: String, enum: TRANSCRIPTION_MODELS, default: "small.en" },
      summarizationModel: { type: String, default: "" }, // empty = server default (OLLAMA_MODEL)
      storageMode: { type: String, enum: STORAGE_MODES, default: "local" },
      captureMicrophone: { type: Boolean, default: true },
      deleteAudioAfterProcessing: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<User>;
export const UserModel = model("User", userSchema);

export function publicUser(user: UserDoc) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    preferences: user.preferences,
    createdAt: user.createdAt,
  };
}
