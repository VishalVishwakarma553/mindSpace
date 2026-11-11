"use client";

import Link from "next/link";
import { ExternalLink, MousePointerClick, Puzzle, ShieldCheck, Video } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

const steps = [
  { icon: Video, title: "Open your Google Meet call", text: "Join the meeting in Chrome as usual." },
  {
    icon: Puzzle,
    title: "Click the MeetMind extension",
    text: "Pin it from the puzzle icon in the toolbar for one-click access.",
  },
  {
    icon: ShieldCheck,
    title: "Tell participants you're recording",
    text: "MeetMind only starts after you confirm everyone has been informed.",
  },
  {
    icon: MousePointerClick,
    title: "Press Start recording",
    text: "Stop when you're done. Transcript and notes appear here automatically.",
  },
];

/**
 * Recording is driven by the Chrome extension (it owns tab audio capture).
 * This dialog explains the four-step journey from PRD §9: Open Meet → Start → Attend → Stop → View notes.
 */
export function RecordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Record a meeting"
      description="MeetMind records from the Google Meet tab through the Chrome extension."
      footer={
        <>
          <Link href="/setup" onClick={() => onOpenChange(false)} className={buttonStyles({ variant: "ghost" })}>
            Setup guide
          </Link>
          <a
            href="https://meet.google.com/new"
            target="_blank"
            rel="noopener noreferrer"
            className={buttonStyles({ variant: "primary" })}
          >
            Open Google Meet <ExternalLink className="size-4" aria-hidden />
          </a>
        </>
      }
    >
      <ol className="flex flex-col gap-4">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <span className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2">
              <s.icon className="size-4.5 text-fg-muted" aria-hidden />
              <span className="absolute -top-1.5 -right-1.5 inline-flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
                {i + 1}
              </span>
            </span>
            <div>
              <p className="text-[15px] font-medium text-fg">{s.title}</p>
              <p className="mt-0.5 text-sm text-fg-subtle">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </Dialog>
  );
}
