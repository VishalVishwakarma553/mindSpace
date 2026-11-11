"use client";

import {
  Download,
  FileText,
  Loader2,
  LocateFixed,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconButton } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/menu";
import { Avatar, EmptyState, Panel } from "@/components/ui/misc";
import { audioUrl } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatTimestamp, speakerColor } from "@/lib/format";
import type { AudioChunk, Meeting, Segment } from "@/lib/types";
import { usePlayer } from "./player";
import { activeIndex, speakersOf, toTurns, UNKNOWN_SPEAKER } from "./transcript-utils";

function SpeakingBars({ color }: { color: string }) {
  return (
    <span aria-hidden className="flex h-3.5 items-end gap-[2px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] origin-bottom animate-pulse rounded-full"
          style={{ background: color, height: `${[60, 100, 75][i]}%`, animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}

/** Speaker tiles echo a video grid: the active speaker gets the large tile. */
function SpeakerTiles({ speakers, active, playing }: { speakers: string[]; active: string | null; playing: boolean }) {
  const list = speakers.length ? speakers : ["Meeting audio"];
  const ordered = active && list.includes(active) ? [active, ...list.filter((s) => s !== active)] : list;
  const [main, ...rest] = ordered;
  const small = rest.slice(0, 2);
  const overflow = rest.length - small.length;

  const tile = (name: string, large: boolean) => {
    const isActive = name === active;
    const color = speakerColor(name);
    return (
      <div
        key={name}
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-2xl border bg-surface-2 transition-colors duration-300",
          large ? "aspect-[16/9]" : "aspect-[4/3]",
          isActive ? "border-transparent ring-2" : "border-border",
        )}
        style={
          {
            "--tw-ring-color": isActive ? `color-mix(in srgb, ${color} 70%, transparent)` : undefined,
            background: `radial-gradient(circle at 50% 40%, color-mix(in srgb, ${color} 10%, var(--surface-2)), var(--surface-2) 70%)`,
          } as React.CSSProperties
        }
      >
        <Avatar name={name} size={large ? 84 : 52} />
        <span className="absolute bottom-3 left-3 inline-flex max-w-[calc(100%-24px)] items-center gap-2 rounded-lg bg-black/55 px-2.5 py-1 text-[13px] text-white backdrop-blur-sm">
          {isActive && playing && <SpeakingBars color={color} />}
          <span className="truncate">{name}</span>
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {main && tile(main, true)}
      {small.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {small.map((s) => tile(s, false))}
        </div>
      )}
      {overflow > 0 && <p className="text-xs text-fg-subtle">+{overflow} more participant{overflow > 1 ? "s" : ""}</p>}
    </div>
  );
}

function Controls({ meetingId, chunks }: { meetingId: string; chunks: AudioChunk[] }) {
  const p = usePlayer();
  const pct = p.duration ? (p.currentTime / p.duration) * 100 : 0;
  return (
    <div className="mt-4">
      <label htmlFor="seek" className="sr-only">
        Seek
      </label>
      <input
        id="seek"
        type="range"
        min={0}
        max={Math.max(1, Math.floor(p.duration))}
        step={1}
        value={Math.floor(p.currentTime)}
        onChange={(e) => p.seek(Number(e.target.value))}
        aria-valuetext={`${formatTimestamp(p.currentTime)} of ${formatTimestamp(p.duration)}`}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-[var(--fg)] [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-fg"
        style={{ background: `linear-gradient(to right, var(--fg) ${pct}%, var(--surface-3) ${pct}%)` }}
      />
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-0.5">
          <Menu>
            <MenuTrigger asChild>
              <IconButton label="Download recording" size="sm" tooltip={false} disabled={!p.hasAudio}>
                <Download className="size-4.5" />
              </IconButton>
            </MenuTrigger>
            <MenuContent align="start">
              <MenuLabel>Recording parts (WebM/Opus)</MenuLabel>
              {chunks.map((c) => (
                <MenuItem key={c.index} asChild>
                  <a href={audioUrl(meetingId, c.index)} download={`part-${c.index + 1}.webm`}>
                    Part {c.index + 1} · {formatTimestamp(c.startTime)}–{formatTimestamp(c.endTime)}
                  </a>
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
          <IconButton label={p.muted ? "Unmute" : "Mute"} size="sm" onClick={p.toggleMute} disabled={!p.hasAudio}>
            {p.muted ? <VolumeX className="size-4.5" /> : <Volume2 className="size-4.5" />}
          </IconButton>
          <button
            type="button"
            onClick={p.cycleRate}
            disabled={!p.hasAudio}
            aria-label={`Playback speed ${p.rate}x`}
            className="inline-flex h-8 min-w-10 cursor-pointer items-center justify-center rounded-lg px-1.5 text-[13px] font-semibold text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg disabled:opacity-40 tabular"
          >
            {p.rate}x
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <IconButton label="Back 10 seconds" variant="secondary" className="rounded-full" onClick={() => p.skip(-10)} disabled={!p.hasAudio}>
            <RotateCcw className="size-4.5" />
          </IconButton>
          <IconButton
            label={p.playing ? "Pause" : "Play"}
            variant="secondary"
            size="lg"
            onClick={p.toggle}
            disabled={!p.hasAudio}
            className="bg-surface-3"
          >
            {p.loading && p.playing ? (
              <Loader2 className="size-5 animate-spin" />
            ) : p.playing ? (
              <Pause className="size-5" fill="currentColor" />
            ) : (
              <Play className="size-5 translate-x-px" fill="currentColor" />
            )}
          </IconButton>
          <IconButton label="Forward 10 seconds" variant="secondary" className="rounded-full" onClick={() => p.skip(10)} disabled={!p.hasAudio}>
            <RotateCw className="size-4.5" />
          </IconButton>
        </div>

        <p className="text-right text-[15px] text-fg tabular" aria-live="off">
          {formatTimestamp(p.currentTime)}
          <span className="mx-1.5 text-fg-subtle">›</span>
          <span className="text-fg-subtle">{formatTimestamp(p.duration)}</span>
        </p>
      </div>
      {p.error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {p.error}
        </p>
      )}
      {!p.hasAudio && (
        <p className="mt-2 text-xs text-fg-subtle">Audio isn&apos;t available for this meeting. Click the transcript to navigate.</p>
      )}
    </div>
  );
}

export function TranscriptList({ segments, compact = false }: { segments: Segment[]; compact?: boolean }) {
  const p = usePlayer();
  const turns = useMemo(() => toTurns(segments), [segments]);
  const active = activeIndex(turns, p.currentTime);
  const [follow, setFollow] = useState(true);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!follow || active < 0) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-turn="${active}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active, follow]);

  if (!turns.length) {
    return <EmptyState icon={FileText} title="No transcript yet" description="The transcript appears here once processing finishes." />;
  }

  return (
    <div className="relative">
      {!follow && (
        <button
          type="button"
          onClick={() => setFollow(true)}
          className="sticky top-0 z-10 mx-auto mb-2 flex cursor-pointer items-center gap-1.5 rounded-full border border-border-strong bg-surface-2 px-3 py-1.5 text-xs text-fg shadow-lg"
        >
          <LocateFixed className="size-3.5" aria-hidden /> Follow playback
        </button>
      )}
      <ol ref={listRef} className="flex flex-col gap-1" onWheel={() => setFollow(false)} onTouchMove={() => setFollow(false)}>
        {turns.map((t, i) => {
          const isActive = i === active;
          return (
            <li key={`${t.startTime}-${i}`} data-turn={i} style={{ contentVisibility: "auto", containIntrinsicSize: "auto 120px" }}>
              <button
                type="button"
                onClick={() => {
                  setFollow(true);
                  p.seek(t.startTime, { play: p.hasAudio ? true : undefined });
                }}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "flex w-full cursor-pointer gap-4 rounded-xl p-3 text-left transition-colors duration-150",
                  isActive ? "bg-surface-2" : "hover:bg-surface-2/60",
                )}
              >
                <Avatar name={t.speaker === UNKNOWN_SPEAKER ? "?" : t.speaker} size={compact ? 40 : 52} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 text-[13px] text-fg-subtle sm:text-sm">
                    <span className={cn(isActive && "text-fg-muted")}>{t.speaker}</span>
                    <span aria-hidden>|</span>
                    <span className="tabular">
                      {formatTimestamp(t.startTime)} - {formatTimestamp(t.endTime)}
                    </span>
                  </span>
                  <span className={cn("mt-1.5 block text-[15px] leading-7", isActive ? "text-fg" : "text-fg-muted")}>{t.text}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function MediaPanel({ meeting, segments, chunks }: { meeting: Meeting; segments: Segment[]; chunks: AudioChunk[] }) {
  const p = usePlayer();
  const speakers = useMemo(() => speakersOf(segments, meeting.participants), [segments, meeting.participants]);
  const idx = activeIndex(segments, p.currentTime);
  const activeSpeaker = idx >= 0 ? segments[idx]?.speaker?.trim() || null : null;

  return (
    <Panel className="flex flex-col p-4 sm:p-6 lg:h-full lg:min-h-0">
      <SpeakerTiles speakers={speakers} active={activeSpeaker} playing={p.playing} />
      <Controls meetingId={meeting.id} chunks={chunks} />
      <h2 className="mt-7 mb-3 text-xl font-medium text-fg">Transcript</h2>
      <div className="-mx-3 min-h-0 flex-1 overflow-y-auto px-0 lg:-mr-4 lg:pr-1">
        <TranscriptList segments={segments} compact />
      </div>
    </Panel>
  );
}
