import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { HttpError, notFound } from "../lib/errors.js";
import { parse } from "../lib/validate.js";
import { AUTH_COOKIE, currentUserId } from "../middleware/auth.js";
import { AudioChunkModel } from "../models/AudioChunk.js";
import { JobModel } from "../models/Job.js";
import { MeetingModel } from "../models/Meeting.js";
import { MeetingNotesModel } from "../models/MeetingNotes.js";
import { TranscriptModel } from "../models/Transcript.js";
import { publicUser, STORAGE_MODES, TRANSCRIPTION_MODELS, UserModel } from "../models/User.js";
import { deleteUserFiles } from "../services/storage.js";

export const usersRouter = Router();

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  preferences: z
    .object({
      transcriptionModel: z.enum(TRANSCRIPTION_MODELS),
      summarizationModel: z.string().trim().max(100),
      storageMode: z.enum(STORAGE_MODES),
      captureMicrophone: z.boolean(),
      deleteAudioAfterProcessing: z.boolean(),
    })
    .partial()
    .optional(),
});

usersRouter.patch("/me", async (req, res) => {
  const body = parse(updateSchema, req.body);
  const set: Record<string, unknown> = {};
  if (body.name) set.name = body.name;
  for (const [k, v] of Object.entries(body.preferences ?? {})) set[`preferences.${k}`] = v;
  const user = await UserModel.findByIdAndUpdate(currentUserId(req), { $set: set }, { returnDocument: "after" });
  if (!user) throw notFound("User");
  res.json({ user: publicUser(user) });
});

/** PRD §8.4 deletion controls: remove the account, every meeting and all audio on disk. */
usersRouter.delete("/me", async (req, res) => {
  const { password } = parse(z.object({ password: z.string().min(1) }), req.body);
  const userId = currentUserId(req);
  const user = await UserModel.findById(userId).select("+passwordHash");
  if (!user) throw notFound("User");
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(403, "Password is incorrect", "invalid_credentials");
  }
  const meetingIds = (await MeetingModel.find({ userId }).select("_id").lean()).map((m) => m._id);
  await Promise.all([
    AudioChunkModel.deleteMany({ meetingId: { $in: meetingIds } }),
    TranscriptModel.deleteMany({ userId }),
    MeetingNotesModel.deleteMany({ userId }),
    JobModel.deleteMany({ userId }),
    MeetingModel.deleteMany({ userId }),
  ]);
  await deleteUserFiles(userId);
  await user.deleteOne();
  res.clearCookie(AUTH_COOKIE, { path: "/" });
  res.status(204).end();
});
