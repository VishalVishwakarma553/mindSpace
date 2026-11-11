import type { Request } from "express";
import { notFound } from "../lib/errors.js";
import { objectId } from "../lib/validate.js";
import { currentUserId } from "../middleware/auth.js";
import { MeetingModel, type Meeting, type MeetingDoc } from "../models/Meeting.js";

/** Load a meeting by route param, scoped to the current user (PRD §8.4 ownership validation). */
export async function ownedMeeting(req: Request, param = "id"): Promise<MeetingDoc> {
  const id = objectId(req.params[param], "Meeting");
  const meeting = await MeetingModel.findOne({ _id: id, userId: currentUserId(req) });
  if (!meeting) throw notFound("Meeting");
  return meeting;
}

type MeetingLike = Meeting & { _id: { toString(): string } };

export function meetingDto(m: MeetingLike, extra: { actionItemCount?: number; openActionItemCount?: number; summary?: string } = {}) {
  return {
    id: m._id.toString(),
    title: m.title,
    platform: m.platform,
    meetingUrl: m.meetingUrl,
    tags: m.tags,
    participants: m.participants,
    status: m.status,
    processingStage: m.processingStage,
    processingError: m.processingError,
    progress: m.progress,
    startedAt: m.startedAt,
    endedAt: m.endedAt ?? null,
    duration: m.duration,
    captureMicrophone: m.captureMicrophone,
    expectedChunks: m.expectedChunks,
    missingChunks: m.missingChunks,
    audioDeleted: m.audioDeleted,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    ...extra,
  };
}
