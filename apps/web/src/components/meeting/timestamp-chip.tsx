"use client";

import { Play } from "lucide-react";
import { formatTimestamp } from "@/lib/format";
import { usePlayer } from "./player";

/** Jump to the transcript moment that supports an AI claim (PRD §5.5 timestamp references). */
export function TimestampChip({ t }: { t: number | null | undefined }) {
  const p = usePlayer();
  if (t === null || t === undefined) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        p.seek(t, { play: p.hasAudio ? true : undefined });
      }}
      aria-label={`Jump to ${formatTimestamp(t)}`}
      className="inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-border bg-surface-2 px-1.5 text-xs text-fg-subtle transition-colors hover:border-border-strong hover:text-fg tabular"
    >
      <Play className="size-2.5" fill="currentColor" aria-hidden />
      {formatTimestamp(t)}
    </button>
  );
}
