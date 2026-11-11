import { Router } from "express";
import mongoose, { Types } from "mongoose";
import { z } from "zod";
import { env } from "../config/env.js";
import { escapeRegex, parse } from "../lib/validate.js";
import { currentUserId } from "../middleware/auth.js";
import { MeetingModel } from "../models/Meeting.js";
import { MeetingNotesModel } from "../models/MeetingNotes.js";
import { TranscriptModel } from "../models/Transcript.js";
import { UserModel } from "../models/User.js";
import { meetingDto } from "../services/meetings.js";
import { ollamaStatus } from "../services/notes/ollama.js";
import { freeDiskBytes } from "../services/storage.js";
import { workerStatus } from "./internal.js";

export const insightsRouter = Router();

/** PRD §5.6 dashboard overview. */
insightsRouter.get("/stats", async (req, res) => {
  const userId = new Types.ObjectId(currentUserId(req));
  const [totals, recent, processing, openTasks] = await Promise.all([
    MeetingModel.aggregate<{ count: number; duration: number }>([
      { $match: { userId } },
      { $group: { _id: null, count: { $sum: 1 }, duration: { $sum: "$duration" } } },
    ]),
    MeetingModel.find({ userId, status: "completed" }).sort({ endedAt: -1 }).limit(5).lean(),
    MeetingModel.find({ userId, status: { $in: ["processing", "recording", "paused", "interrupted", "failed"] } })
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean(),
    MeetingNotesModel.aggregate<{ count: number }>([
      { $match: { userId } },
      { $unwind: "$actionItems" },
      { $match: { "actionItems.status": "open" } },
      { $count: "count" },
    ]),
  ]);
  res.json({
    totalMeetings: totals[0]?.count ?? 0,
    totalDuration: totals[0]?.duration ?? 0,
    openActionItems: openTasks[0]?.count ?? 0,
    recent: recent.map((m) => meetingDto(m)),
    active: processing.map((m) => meetingDto(m)),
  });
});

/** Cross-meeting search over titles, transcripts and notes, with timestamped hits (PRD §13). */
insightsRouter.get("/search", async (req, res) => {
  const { q } = parse(z.object({ q: z.string().trim().min(2).max(200) }), req.query);
  const userId = currentUserId(req);
  const pattern = new RegExp(escapeRegex(q), "i");
  const terms = q.toLowerCase().split(/\s+/).filter((t) => t.length > 1);

  const [titleHits, transcripts, notesHits] = await Promise.all([
    MeetingModel.find({ userId, title: pattern }).sort({ startedAt: -1 }).limit(10).lean(),
    TranscriptModel.find({ userId, $text: { $search: q } }, { score: { $meta: "textScore" } })
      .sort({ score: { $meta: "textScore" } })
      .limit(20)
      .lean(),
    MeetingNotesModel.find({
      userId,
      $or: [{ executiveSummary: pattern }, { "actionItems.task": pattern }, { "decisions.description": pattern }],
    })
      .select("meetingId executiveSummary actionItems decisions")
      .limit(20)
      .lean(),
  ]);

  const meetingIds = new Set<string>([
    ...titleHits.map((m) => m._id.toString()),
    ...transcripts.map((t) => t.meetingId.toString()),
    ...notesHits.map((n) => n.meetingId.toString()),
  ]);
  const meetings = await MeetingModel.find({ _id: { $in: [...meetingIds] }, userId }).lean();
  const byId = new Map(meetings.map((m) => [m._id.toString(), m]));

  const results = [...meetingIds].flatMap((id) => {
    const meeting = byId.get(id);
    if (!meeting) return [];
    const transcript = transcripts.find((t) => t.meetingId.toString() === id);
    const notes = notesHits.find((n) => n.meetingId.toString() === id);
    const moments = (transcript?.segments ?? [])
      .filter((s) => terms.some((t) => s.text.toLowerCase().includes(t)))
      .slice(0, 5)
      .map((s) => ({ startTime: s.startTime, speaker: s.speaker, text: s.text }));
    const tasks = (notes?.actionItems ?? []).filter((a) => pattern.test(a.task)).map((a) => a.task).slice(0, 3);
    const decisions = (notes?.decisions ?? [])
      .filter((d) => pattern.test(d.description))
      .map((d) => d.description)
      .slice(0, 3);
    return [{ meeting: meetingDto(meeting), titleMatch: pattern.test(meeting.title), moments, tasks, decisions }];
  });
  results.sort((a, b) => +new Date(b.meeting.startedAt) - +new Date(a.meeting.startedAt));
  res.json({ query: q, results });
});

/** Every action item across meetings, for the Tasks view. */
insightsRouter.get("/action-items", async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(["open", "done", "all"]).default("all") }), req.query);
  const userId = new Types.ObjectId(currentUserId(req));
  const items = await MeetingNotesModel.aggregate([
    { $match: { userId } },
    { $unwind: "$actionItems" },
    ...(status === "all" ? [] : [{ $match: { "actionItems.status": status } }]),
    { $lookup: { from: "meetings", localField: "meetingId", foreignField: "_id", as: "meeting" } },
    { $unwind: "$meeting" },
    {
      $project: {
        _id: 0,
        id: { $toString: "$actionItems._id" },
        meetingId: { $toString: "$meetingId" },
        meetingTitle: "$meeting.title",
        meetingDate: "$meeting.startedAt",
        task: "$actionItems.task",
        assignedTo: "$actionItems.assignedTo",
        deadline: "$actionItems.deadline",
        deadlineText: "$actionItems.deadlineText",
        status: "$actionItems.status",
        uncertain: "$actionItems.uncertain",
        timestamp: "$actionItems.timestamp",
      },
    },
    { $sort: { status: -1, deadline: 1, meetingDate: -1 } },
    { $limit: 500 },
  ]);
  res.json({ items });
});

/** Setup guide checks: is every local dependency reachable? (PRD §5.1) */
insightsRouter.get("/system/status", async (req, res) => {
  const [ollama, disk, user] = await Promise.all([
    ollamaStatus(),
    freeDiskBytes(),
    UserModel.findById(currentUserId(req)).lean(),
  ]);
  const worker = workerStatus();
  const preferredModel = user?.preferences?.summarizationModel || env.OLLAMA_MODEL;
  res.json({
    database: { connected: mongoose.connection.readyState === 1 },
    ollama: {
      ...ollama,
      url: env.OLLAMA_URL,
      model: preferredModel,
      modelInstalled: ollama.models.some((m) => m === preferredModel || m.split(":")[0] === preferredModel),
    },
    worker: {
      online: Boolean(worker && Date.now() - worker.at.getTime() < 60_000),
      lastSeenAt: worker?.at ?? null,
    },
    disk: { freeBytes: disk, minFreeBytes: env.MIN_FREE_DISK_MB * 1024 * 1024 },
  });
});
