import { Router } from "express";
import type { Types } from "mongoose";
import { z } from "zod";
import { badRequest, notFound } from "../lib/errors.js";
import { objectId, parse } from "../lib/validate.js";
import { MeetingNotesModel } from "../models/MeetingNotes.js";
import { TranscriptModel } from "../models/Transcript.js";
import { ownedMeeting } from "../services/meetings.js";

/** Manual corrections to AI output (PRD §5.7). Mounted under /api/meetings. */
export const notesRouter = Router();

const str = z.string().trim().max(5000);
const strList = z.array(z.string().trim().min(1).max(1000)).max(200);

const notesPatch = z
  .object({
    objective: str,
    executiveSummary: str,
    discussionPoints: z
      .array(z.object({ topic: z.string().trim().min(1).max(300), details: str, timestamp: z.number().nullable().default(null) }))
      .max(200),
    decisions: z
      .array(z.object({ description: z.string().trim().min(1).max(1000), timestamp: z.number().nullable().default(null) }))
      .max(200),
    suggestions: strList,
    pendingQuestions: strList,
    nextSteps: strList,
    uncertainties: strList,
  })
  .partial();

async function notesFor(meetingId: Types.ObjectId, userId: Types.ObjectId) {
  return (
    (await MeetingNotesModel.findOne({ meetingId })) ??
    // Users may start notes manually before / without AI processing.
    new MeetingNotesModel({ meetingId, userId })
  );
}

notesRouter.patch("/:id/notes", async (req, res) => {
  const body = parse(notesPatch, req.body);
  const meeting = await ownedMeeting(req);
  const notes = await notesFor(meeting._id, meeting.userId);
  notes.set({ ...body, editedByUser: true });
  if (body.objective !== undefined) notes.overview = body.objective;
  await notes.save();
  res.json({ notes });
});

const deadline = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"), z.literal(""), z.null()])
  .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : null));

const actionCreate = z.object({
  task: z.string().trim().min(1, "Task is required").max(500),
  assignedTo: z.string().trim().max(80).default(""),
  deadline: deadline.default(null),
  status: z.enum(["open", "done"]).default("open"),
});
const actionPatch = z
  .object({
    task: z.string().trim().min(1).max(500),
    assignedTo: z.string().trim().max(80),
    deadline,
    status: z.enum(["open", "done"]),
  })
  .partial();

notesRouter.post("/:id/action-items", async (req, res) => {
  const body = parse(actionCreate, req.body);
  const meeting = await ownedMeeting(req);
  const notes = await notesFor(meeting._id, meeting.userId);
  notes.actionItems.push({ ...body, source: "user" });
  notes.editedByUser = true;
  await notes.save();
  res.status(201).json({ item: notes.actionItems.at(-1) });
});

notesRouter.patch("/:id/action-items/:itemId", async (req, res) => {
  const body = parse(actionPatch, req.body);
  const meeting = await ownedMeeting(req);
  const itemId = objectId(req.params.itemId, "Action item");
  const notes = await MeetingNotesModel.findOne({ meetingId: meeting._id });
  const item = notes?.actionItems.id(itemId);
  if (!notes || !item) throw notFound("Action item");
  item.set(body);
  // A user-confirmed owner or deadline is no longer uncertain.
  if (body.assignedTo !== undefined || body.deadline !== undefined) item.uncertain = false;
  notes.editedByUser = true;
  await notes.save();
  res.json({ item });
});

notesRouter.delete("/:id/action-items/:itemId", async (req, res) => {
  const meeting = await ownedMeeting(req);
  const itemId = objectId(req.params.itemId, "Action item");
  const result = await MeetingNotesModel.updateOne(
    { meetingId: meeting._id },
    { $pull: { actionItems: { _id: itemId } }, $set: { editedByUser: true } },
  );
  if (result.modifiedCount === 0) throw notFound("Action item");
  res.status(204).end();
});

notesRouter.patch("/:id/transcript/segments/:index", async (req, res) => {
  const body = parse(
    z.object({ text: z.string().trim().min(1).max(5000), speaker: z.string().trim().max(80) }).partial(),
    req.body,
  );
  const meeting = await ownedMeeting(req);
  const index = parse(z.coerce.number().int().min(0), req.params.index);
  const transcript = await TranscriptModel.findOne({ meetingId: meeting._id });
  const segment = transcript?.segments[index];
  if (!transcript || !segment) throw notFound("Transcript segment");
  if (body.text !== undefined) segment.text = body.text;
  if (body.speaker !== undefined) segment.speaker = body.speaker;
  await transcript.save();
  res.json({ segment });
});

/** Rename a speaker label everywhere, e.g. "Speaker 1" → "Kristin". */
notesRouter.post("/:id/transcript/speakers", async (req, res) => {
  const { from, to } = parse(
    z.object({ from: z.string().trim().max(80), to: z.string().trim().min(1).max(80) }),
    req.body,
  );
  if (from === to) throw badRequest("New name must differ");
  const meeting = await ownedMeeting(req);
  const result = await TranscriptModel.updateOne(
    { meetingId: meeting._id },
    { $set: { "segments.$[seg].speaker": to } },
    { arrayFilters: [{ "seg.speaker": from }] },
  );
  if (!meeting.participants.includes(to)) {
    meeting.participants.push(to);
    await meeting.save();
  }
  res.json({ updated: result.modifiedCount > 0 });
});
