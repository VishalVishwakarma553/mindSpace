import { AlertTriangle, CheckCircle2, CircleDot, Loader2, PauseCircle, Unplug } from "lucide-react";
import { Chip } from "@/components/ui/misc";
import type { Meeting } from "@/lib/types";

/** Status always shown as icon + text, never colour alone (ui-ux-pro-max: color-not-only). */
export function StatusBadge({ meeting, className }: { meeting: Pick<Meeting, "status" | "processingStage">; className?: string }) {
  switch (meeting.status) {
    case "completed":
      return (
        <Chip tone="success" className={className}>
          <CheckCircle2 className="size-3.5" aria-hidden /> Notes ready
        </Chip>
      );
    case "processing":
      return (
        <Chip tone="accent" className={className}>
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {meeting.processingStage === "summarizing"
            ? "Summarizing"
            : meeting.processingStage === "transcribing"
              ? "Transcribing"
              : "Queued"}
        </Chip>
      );
    case "recording":
      return (
        <Chip tone="danger" className={className}>
          <CircleDot className="size-3.5" aria-hidden /> Recording
        </Chip>
      );
    case "paused":
      return (
        <Chip tone="amber" className={className}>
          <PauseCircle className="size-3.5" aria-hidden /> Paused
        </Chip>
      );
    case "interrupted":
      return (
        <Chip tone="orange" className={className}>
          <Unplug className="size-3.5" aria-hidden /> Interrupted
        </Chip>
      );
    case "failed":
      return (
        <Chip tone="danger" className={className}>
          <AlertTriangle className="size-3.5" aria-hidden /> Failed
        </Chip>
      );
  }
}
