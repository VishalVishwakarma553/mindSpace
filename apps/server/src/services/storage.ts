import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { HttpError } from "../lib/errors.js";

const root = env.STORAGE_DIR;

/** Resolve a path inside the storage root, refusing anything that escapes it. */
function inside(...parts: string[]): string {
  const resolved = path.resolve(root, ...parts);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new HttpError(400, "Invalid storage path", "bad_path");
  }
  return resolved;
}

export const meetingDir = (userId: string, meetingId: string) => inside(userId, meetingId);

export const chunkFileName = (index: number) => `chunk-${String(index).padStart(4, "0")}.webm`;

export async function ensureStorageRoot(): Promise<void> {
  await fs.mkdir(root, { recursive: true });
}

export async function freeDiskBytes(): Promise<number | null> {
  try {
    const stats = await fs.statfs(root);
    return stats.bavail * stats.bsize;
  } catch {
    return null;
  }
}

/** PRD §12: monitor disk space and refuse new audio before the disk is exhausted. */
export async function assertDiskSpace(): Promise<void> {
  const free = await freeDiskBytes();
  if (free !== null && free < env.MIN_FREE_DISK_MB * 1024 * 1024) {
    throw new HttpError(507, "Not enough free disk space to store audio", "insufficient_storage");
  }
}

/** Atomically move an uploaded temp file into the meeting folder (write-then-rename). */
export async function storeChunk(
  userId: string,
  meetingId: string,
  index: number,
  tempPath: string,
): Promise<string> {
  const dir = meetingDir(userId, meetingId);
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, chunkFileName(index));
  try {
    await fs.rename(tempPath, target);
  } catch {
    // Cross-device temp dirs cannot be renamed; fall back to copy.
    await fs.copyFile(tempPath, target);
    await fs.rm(tempPath, { force: true });
  }
  return target;
}

export async function deleteMeetingFiles(userId: string, meetingId: string): Promise<void> {
  await fs.rm(meetingDir(userId, meetingId), { recursive: true, force: true });
}

export async function deleteUserFiles(userId: string): Promise<void> {
  await fs.rm(inside(userId), { recursive: true, force: true });
}

export const uploadTempDir = () => inside(".tmp");
