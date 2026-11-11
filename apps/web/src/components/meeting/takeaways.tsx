"use client";

import { FileText, NotebookText, Video } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/menu";
import { SectionTitle } from "@/components/ui/misc";
import { exportUrl } from "@/lib/api";
import { formatBytes, formatDuration } from "@/lib/format";
import type { AudioChunk, MeetingDetail } from "@/lib/types";
import { usePlayer } from "./player";

function FileCard({
  icon: Icon,
  tone,
  title,
  meta,
  ...props
}: {
  icon: typeof FileText;
  tone: "accent" | "teal";
  title: string;
  meta: string[];
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="flex w-full cursor-pointer items-center gap-4 rounded-2xl border border-border bg-surface p-4 text-left transition-colors duration-150 hover:border-border-strong hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
      {...props}
    >
      <span
        className={
          tone === "accent"
            ? "inline-flex size-14 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"
            : "inline-flex size-14 shrink-0 items-center justify-center rounded-xl bg-teal-soft text-teal"
        }
      >
        <Icon className="size-6" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-lg font-medium text-fg">{title}</span>
        <span className="mt-0.5 flex items-center gap-2 text-[15px] text-fg-subtle">
          {meta.map((m, i) => (
            <span key={m} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden>|</span>}
              {m}
            </span>
          ))}
        </span>
      </span>
    </button>
  );
}

/** "Meeting Takeaways": the transcript document and the recording, as in the reference design. */
export function Takeaways({ detail, audio }: { detail: MeetingDetail; audio: AudioChunk[] }) {
  const p = usePlayer();
  const words = detail.transcript?.segments.reduce((n, s) => n + s.text.split(/\s+/).length, 0) ?? 0;
  const audioBytes = audio.reduce((n, c) => n + c.fileSize, 0);
  const id = detail.meeting.id;

  return (
    <section aria-labelledby="takeaways-title">
      <SectionTitle icon={NotebookText} className="[&_h2]:text-xl">
        <span id="takeaways-title">Meeting Takeaways</span>
      </SectionTitle>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
        <Menu>
          <MenuTrigger asChild>
            <FileCard
              icon={FileText}
              tone="accent"
              title="Conversation Transcript"
              meta={[`${words.toLocaleString()} words`, detail.transcript?.status === "partial" ? "Partial" : "Export"]}
              disabled={!detail.transcript}
              aria-label="Export transcript"
            />
          </MenuTrigger>
          <MenuContent align="start">
            <MenuLabel>Download transcript</MenuLabel>
            {(["pdf", "md", "txt"] as const).map((f) => (
              <MenuItem key={f} asChild>
                <a href={exportUrl(id, f, "transcript")} download>
                  {f === "md" ? "Markdown" : f.toUpperCase()}
                </a>
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
        <FileCard
          icon={Video}
          tone="teal"
          title="Meeting Recording"
          meta={
            audio.length
              ? [formatBytes(audioBytes), `${audio.length} part${audio.length > 1 ? "s" : ""}`, "WEBM"]
              : [detail.meeting.audioDeleted ? "Deleted after processing" : "No audio stored"]
          }
          disabled={!audio.length}
          onClick={() => p.seek(0, { play: true })}
          aria-label={audio.length ? `Play recording, ${formatDuration(detail.meeting.duration)}` : "Recording unavailable"}
        />
      </div>
    </section>
  );
}
