import fs from "node:fs";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { env } from "../config/env.js";
import { badRequest, conflict } from "../lib/errors.js";
import { parse } from "../lib/validate.js";
import { currentUserId } from "../middleware/auth.js";
import { AudioChunkModel } from "../models/AudioChunk.js";
import { MeetingModel } from "../models/Meeting.js";
import { TranscriptModel } from "../models/Transcript.js";
import { meetingDto, ownedMeeting } from "../services/meetings.js";
import { meetingEvent, resummarize, startProcessing } from "../services/processing.js";
import { assertDiskSpace, storeChunk, uploadTempDir } from "../services/storage.js";

/**
 * Recording lifecycle used by the Chrome extension (PRD §5.2, §5.3, §6.3):
 * create → upload 5-minute chunks → heartbeat → finish → pipeline.
 */
export const recordingRouter = Router();

fs.mkdirSync(uploadTempDir(), { recursive: true });
const upload = multer({
  dest: uploadTempDir(),
  limits: { fileSize: env.MAX_CHUNK_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = /^(audio\/|video\/webm|application\/octet-stream)/.test(file.mimetype);
    if (!ok) return cb(badRequest(`Unsupported audio type ${file.mimetype}`));
    cb(null, true);
  },
});

const createSchema = z.object({
  title: z.string().trim().min(1).max(200).default("Untitled meeting"),
  meetingUrl: z.string().trim().max(500).default(""),
  platform: z.enum(["google_meet", "other"]).default("google_meet"),
  startedAt: z.coerce.date().default(() => new Date()),
  captureMicrophone: z.boolean().default(false),
  consentConfirmed: z.literal(true, { error: "Participants must be informed before recording" }),
});

recordingRouter.post("/", async (req, res) => {
  const body = parse(createSchema, req.body);
  await assertDiskSpace();
  const meeting = await MeetingModel.create({
    ...body,
    userId: currentUserId(req),
    status: "recording",
    lastHeartbeatAt: new Date(),
  });
  res.status(201).json({ meeting: meetingDto(meeting) });
});

const RECORDING_STATES = new Set(["recording", "paused", "interrupted"]);

const chunkSchema = z
  .object({
    startTime: z.coerce.number().min(0),
    endTime: z.coerce.number().min(0),
  })
  .refine((v) => v.endTime > v.startTime, { message: "endTime must be after startTime" });

/** Idempotent chunk upload: re-sending the same index replaces it unless it was already transcribed. */
recordingRouter.put("/:id/chunks/:index", upload.single("audio"), async (req, res) => {
  const file = req.file;
  try {
    const meeting = await ownedMeeting(req);
    if (!RECORDING_STATES.has(meeting.status)) throw conflict(`Meeting is ${meeting.status}; cannot add audio`);
    if (!file) throw badRequest("Missing audio file field 'audio'");
    const index = parse(z.coerce.number().int().min(0).max(10_000), req.params.index);
    const { startTime, endTime } = parse(chunkSchema, req.body);
    await assertDiskSpace();

    const existing = await AudioChunkModel.findOne({ meetingId: meeting._id, chunkIndex: index }).lean();
    if (existing?.status === "transcribed") {
      res.json({ chunk: { index, status: existing.status }, duplicate: true });
      return;
    }

    const filePath = await storeChunk(meeting.userId.toString(), meeting._id.toString(), index, file.path);
    await AudioChunkModel.findOneAndUpdate(
      { meetingId: meeting._id, chunkIndex: index },
      {
        $set: {
          filePath,
          mimeType: file.mimetype,
          startTime,
          endTime,
          duration: endTime - startTime,
          fileSize: file.size,
          status: "pending",
          segments: [],
        },
      },
      { upsert: true },
    );

    meeting.duration = Math.max(meeting.duration, Math.round(endTime));
    meeting.lastHeartbeatAt = new Date();
    if (meeting.status === "interrupted") meeting.status = "recording";
    await meeting.save();
    meetingEvent(meeting);
    res.status(201).json({ chunk: { index, status: "pending" } });
  } finally {
    if (file) fs.rm(file.path, { force: true }, () => undefined);
  }
});

recordingRouter.post("/:id/heartbeat", async (req, res) => {
  const body = parse(
    z.object({ state: z.enum(["recording", "paused"]), elapsed: z.number().min(0).optional() }),
    req.body,
  );
  const meeting = await ownedMeeting(req);
  if (!RECORDING_STATES.has(meeting.status)) throw conflict(`Meeting is ${meeting.status}`);
  meeting.status = body.state;
  meeting.lastHeartbeatAt = new Date();
  if (body.elapsed) meeting.duration = Math.max(meeting.duration, Math.round(body.elapsed));
  await meeting.save();
  meetingEvent(meeting);
  res.json({ meeting: meetingDto(meeting) });
});

recordingRouter.post("/:id/finish", async (req, res) => {
  const body = parse(
    z.object({
      totalChunks: z.number().int().min(0).max(10_000),
      duration: z.number().min(0).optional(),
      endedAt: z.coerce.date().optional(),
    }),
    req.body,
  );
  const meeting = await ownedMeeting(req);
  if (!RECORDING_STATES.has(meeting.status)) throw conflict(`Meeting is already ${meeting.status}`);

  const present = new Set(
    (await AudioChunkModel.find({ meetingId: meeting._id }).select("chunkIndex").lean()).map((c) => c.chunkIndex),
  );
  meeting.expectedChunks = body.totalChunks;
  meeting.missingChunks = Array.from({ length: body.totalChunks }, (_, i) => i).filter((i) => !present.has(i));
  meeting.endedAt = body.endedAt ?? new Date();
  if (body.duration) meeting.duration = Math.round(body.duration);
  await startProcessing(meeting);
  res.json({ meeting: meetingDto(meeting) });
});

/** Retry after a failure or recover an interrupted recording. Completed chunks are skipped. */
recordingRouter.post("/:id/reprocess", async (req, res) => {
  const { stage } = parse(z.object({ stage: z.enum(["all", "summary"]).default("all") }), req.body ?? {});
  const meeting = await ownedMeeting(req);
  if (meeting.status === "recording" || meeting.status === "paused") {
    throw conflict("Stop the recording before processing it");
  }
  if (meeting.status === "processing") throw conflict("Meeting is already being processed");
  if (meeting.status === "interrupted" && !meeting.endedAt) meeting.endedAt = meeting.lastHeartbeatAt ?? new Date();

  if (stage === "summary" && (await TranscriptModel.exists({ meetingId: meeting._id }))) {
    await resummarize(meeting);
  } else {
    await startProcessing(meeting);
  }
  res.json({ meeting: meetingDto(meeting) });
});
