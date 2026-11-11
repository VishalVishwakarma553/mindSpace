import { Router } from "express";
import type { QueryFilter, Types } from "mongoose";
import { z } from "zod";
import { notFound } from "../lib/errors.js";
import { escapeRegex, parse } from "../lib/validate.js";
import { currentUserId } from "../middleware/auth.js";
import { AudioChunkModel } from "../models/AudioChunk.js";
import { JobModel } from "../models/Job.js";
import { MEETING_STATUSES, MeetingModel, type Meeting } from "../models/Meeting.js";
import { MeetingNotesModel } from "../models/MeetingNotes.js";
import { TranscriptModel } from "../models/Transcript.js";
import {
  buildBlocks,
  EXPORT_FORMATS,
  EXPORT_SECTIONS,
  exportFileName,
  toMarkdown,
  toText,
  writePdf,
} from "../services/export.js";
import { buildFollowUpEmail } from "../services/followup.js";
import { meetingDto, ownedMeeting } from "../services/meetings.js";
import { publish } from "../services/realtime.js";
import { deleteMeetingFiles } from "../services/storage.js";

export const meetingsRouter = Router();

const listSchema = z.object({
  q: z.string().trim().max(200).optional(),
  searchTranscript: z.enum(["true", "false"]).default("false"),
  status: z.enum(MEETING_STATUSES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** PRD §5.6 meeting history with search, filters and date sorting. */
meetingsRouter.get("/", async (req, res) => {
  const query = parse(listSchema, req.query);
  const userId = currentUserId(req);
  const filter: QueryFilter<Meeting> = { userId };
  if (query.status) filter.status = query.status;
  if (query.from || query.to) {
    filter.startedAt = {
      ...(query.from && { $gte: query.from }),
      ...(query.to && { $lte: query.to }),
    };
  }
  if (query.q) {
    const or: QueryFilter<Meeting>[] = [{ title: { $regex: escapeRegex(query.q), $options: "i" } }];
    if (query.searchTranscript === "true") {
      const hits = await TranscriptModel.find({ userId, $text: { $search: query.q } }).select("meetingId").lean();
      if (hits.length) or.push({ _id: { $in: hits.map((h) => h.meetingId) } });
    }
    filter.$or = or;
  }

  const [items, total] = await Promise.all([
    MeetingModel.find(filter)
      .sort({ startedAt: query.sort === "asc" ? 1 : -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    MeetingModel.countDocuments(filter),
  ]);

  const notes = await MeetingNotesModel.find({ meetingId: { $in: items.map((m) => m._id) } })
    .select("meetingId executiveSummary actionItems.status")
    .lean();
  const byMeeting = new Map(notes.map((n) => [n.meetingId.toString(), n]));

  res.json({
    items: items.map((m) => {
      const n = byMeeting.get(m._id.toString());
      return meetingDto(m, {
        summary: n?.executiveSummary ?? "",
        actionItemCount: n?.actionItems.length ?? 0,
        openActionItemCount: n?.actionItems.filter((a) => a.status !== "done").length ?? 0,
      });
    }),
    total,
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit)),
  });
});

meetingsRouter.get("/:id", async (req, res) => {
  const meeting = await ownedMeeting(req);
  const [notes, transcript, chunks] = await Promise.all([
    MeetingNotesModel.findOne({ meetingId: meeting._id }).lean(),
    TranscriptModel.findOne({ meetingId: meeting._id }).select("segments language status").lean(),
    AudioChunkModel.find({ meetingId: meeting._id })
      .sort({ chunkIndex: 1 })
      .select("chunkIndex startTime endTime duration fileSize status")
      .lean(),
  ]);
  res.json({
    meeting: meetingDto(meeting),
    notes: notes && { ...notes, id: notes._id.toString(), _id: undefined },
    transcript: transcript && {
      segments: transcript.segments,
      language: transcript.language,
      status: transcript.status,
    },
    audio: meeting.audioDeleted
      ? []
      : chunks.map((c) => ({
          index: c.chunkIndex,
          startTime: c.startTime,
          endTime: c.endTime,
          duration: c.duration,
          fileSize: c.fileSize,
          status: c.status,
        })),
  });
});

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  participants: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
});

meetingsRouter.patch("/:id", async (req, res) => {
  const body = parse(patchSchema, req.body);
  const meeting = await ownedMeeting(req);
  meeting.set(body);
  await meeting.save();
  res.json({ meeting: meetingDto(meeting) });
});

meetingsRouter.delete("/:id", async (req, res) => {
  const meeting = await ownedMeeting(req);
  const meetingId = meeting._id;
  await Promise.all([
    AudioChunkModel.deleteMany({ meetingId }),
    TranscriptModel.deleteOne({ meetingId }),
    MeetingNotesModel.deleteOne({ meetingId }),
    JobModel.deleteMany({ meetingId }),
  ]);
  await deleteMeetingFiles(meeting.userId.toString(), meetingId.toString());
  await meeting.deleteOne();
  publish(meeting.userId.toString(), { type: "meeting.deleted", meetingId: meetingId.toString() });
  res.status(204).end();
});

/** Stream one audio chunk. Files are only reachable through this ownership-checked route (PRD §8.4). */
meetingsRouter.get("/:id/audio/:index", async (req, res) => {
  const meeting = await ownedMeeting(req);
  const index = parse(z.coerce.number().int().min(0), req.params.index);
  const chunk = await AudioChunkModel.findOne({ meetingId: meeting._id, chunkIndex: index }).lean();
  if (!chunk || meeting.audioDeleted) throw notFound("Audio");
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.type(chunk.mimeType.startsWith("video/") ? "audio/webm" : chunk.mimeType);
  res.sendFile(chunk.filePath, { dotfiles: "deny" }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: { code: "not_found", message: "Audio not found" } });
  });
});

async function exportInput(meetingId: Types.ObjectId, meeting: Awaited<ReturnType<typeof ownedMeeting>>) {
  const [notes, transcript] = await Promise.all([
    MeetingNotesModel.findOne({ meetingId }).lean(),
    TranscriptModel.findOne({ meetingId }).select("segments").lean(),
  ]);
  return { meeting, notes, segments: transcript?.segments ?? [] };
}

/** PRD §5.8 export: summary, transcript, action items or everything, as Markdown, TXT or PDF. */
meetingsRouter.get("/:id/export", async (req, res) => {
  const { format, section } = parse(
    z.object({ format: z.enum(EXPORT_FORMATS).default("md"), section: z.enum(EXPORT_SECTIONS).default("all") }),
    req.query,
  );
  const meeting = await ownedMeeting(req);
  const blocks = buildBlocks(await exportInput(meeting._id, meeting), section);
  const filename = exportFileName(section === "all" ? meeting.title : `${meeting.title}-${section}`, format);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  if (format === "pdf") {
    res.type("application/pdf");
    writePdf(blocks, res);
    return;
  }
  res.type(format === "md" ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8");
  res.send(format === "md" ? toMarkdown(blocks) : toText(blocks));
});

meetingsRouter.get("/:id/follow-up", async (req, res) => {
  const meeting = await ownedMeeting(req);
  const { notes } = await exportInput(meeting._id, meeting);
  res.json(buildFollowUpEmail({ meeting, notes }));
});
