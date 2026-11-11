import { CalendarDays, Clock3, ListChecks } from "lucide-react";
import Link from "next/link";
import { Chip, ProgressBar, tagTone } from "@/components/ui/misc";
import { formatDate, formatDuration, formatTime } from "@/lib/format";
import type { Meeting } from "@/lib/types";
import { StatusBadge } from "./status-badge";

/** PRD §5.6 meeting card: title, date, duration, status, short summary, action item count. */
export function MeetingCard({ meeting }: { meeting: Meeting }) {
  const processing = meeting.status === "processing" && meeting.progress.total > 0;
  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="group flex h-full flex-col rounded-[var(--radius-panel)] border border-border bg-surface p-5 transition-colors duration-150 hover:border-border-strong hover:bg-surface-2"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 text-[15px] leading-6 font-medium text-fg">{meeting.title}</h3>
        <StatusBadge meeting={meeting} className="shrink-0" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-fg-subtle">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-3.5" aria-hidden />
          {formatDate(meeting.startedAt)} · {formatTime(meeting.startedAt)}
        </span>
        <span className="inline-flex items-center gap-1.5 tabular">
          <Clock3 className="size-3.5" aria-hidden />
          {formatDuration(meeting.duration)}
        </span>
      </div>

      {processing ? (
        <div className="mt-4">
          <ProgressBar value={meeting.progress.done / meeting.progress.total} label="Processing progress" />
          <p className="mt-2 text-xs text-fg-subtle tabular">
            {meeting.processingStage === "summarizing" ? "Writing notes" : "Transcribing"} · {meeting.progress.done}/
            {meeting.progress.total}
          </p>
        </div>
      ) : meeting.status === "failed" ? (
        <p className="mt-3 line-clamp-2 text-sm text-danger/90">{meeting.processingError || "Processing failed."}</p>
      ) : (
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-fg-muted">
          {meeting.summary || <span className="text-fg-subtle">No summary yet.</span>}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <div className="flex min-w-0 gap-1.5 overflow-hidden">
          {meeting.tags.slice(0, 2).map((t, i) => (
            <Chip key={t} tone={tagTone(i)} className="h-6 text-xs">
              {t}
            </Chip>
          ))}
        </div>
        {typeof meeting.actionItemCount === "number" && meeting.actionItemCount > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] text-fg-subtle">
            <ListChecks className="size-3.5" aria-hidden />
            {meeting.openActionItemCount ?? 0}/{meeting.actionItemCount} open
          </span>
        )}
      </div>
    </Link>
  );
}

export function MeetingCardSkeleton() {
  return (
    <div className="rounded-[var(--radius-panel)] border border-border bg-surface p-5">
      <div className="skeleton h-5 w-3/4 rounded" />
      <div className="skeleton mt-3 h-4 w-1/2 rounded" />
      <div className="skeleton mt-4 h-4 w-full rounded" />
      <div className="skeleton mt-2 h-4 w-5/6 rounded" />
    </div>
  );
}
