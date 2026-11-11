"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { audioUrl } from "@/lib/api";
import type { AudioChunk } from "@/lib/types";

export const RATES = [1, 1.25, 1.5, 2, 0.75] as const;

export interface PlayerState {
  hasAudio: boolean;
  playing: boolean;
  loading: boolean;
  error: string;
  currentTime: number;
  duration: number;
  rate: number;
  muted: boolean;
  toggle: () => void;
  seek: (t: number, opts?: { play?: boolean }) => void;
  skip: (delta: number) => void;
  cycleRate: () => void;
  toggleMute: () => void;
}

const PlayerContext = createContext<PlayerState | null>(null);

export function usePlayer(): PlayerState {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}

/**
 * Plays a meeting stored as consecutive 5-minute chunks as if it were one file.
 * Global time = chunk.startTime + audio.currentTime. Without audio (deleted, or a
 * transcript-only meeting) `seek` still moves a virtual cursor so transcript
 * navigation keeps working.
 */
export function PlayerProvider({
  meetingId,
  chunks,
  duration,
  children,
}: {
  meetingId: string;
  chunks: AudioChunk[];
  duration: number;
  children: React.ReactNode;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunkRef = useRef(-1);
  const pendingOffset = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [rate, setRate] = useState(1);
  const [muted, setMuted] = useState(false);

  const sorted = useMemo(() => [...chunks].sort((a, b) => a.startTime - b.startTime), [chunks]);
  const hasAudio = sorted.length > 0;
  const total = Math.max(duration, sorted.at(-1)?.endTime ?? 0);

  // Refs mirror state for event handlers registered once.
  const sortedRef = useRef(sorted);
  sortedRef.current = sorted;
  const rateRef = useRef(rate);
  rateRef.current = rate;

  const load = useCallback(
    (idx: number, offset: number, autoplay: boolean) => {
      const audio = audioRef.current;
      const chunk = sortedRef.current[idx];
      if (!audio || !chunk) return;
      chunkRef.current = idx;
      pendingOffset.current = offset;
      setLoading(true);
      setError("");
      audio.src = audioUrl(meetingId, chunk.index);
      audio.playbackRate = rateRef.current;
      audio.load();
      if (autoplay) void audio.play().catch(() => setPlaying(false));
    },
    [meetingId],
  );

  useEffect(() => {
    if (!hasAudio) return;
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const onLoaded = () => {
      if (pendingOffset.current > 0) {
        audio.currentTime = pendingOffset.current;
        pendingOffset.current = 0;
      }
      setLoading(false);
    };
    const onTime = () => {
      const chunk = sortedRef.current[chunkRef.current];
      if (chunk) setCurrentTime(chunk.startTime + audio.currentTime);
    };
    const onEnded = () => {
      const next = chunkRef.current + 1;
      if (next < sortedRef.current.length) load(next, 0, true);
      else setPlaying(false);
    };
    const onError = () => {
      setLoading(false);
      setPlaying(false);
      setError("This part of the recording could not be played.");
    };
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("play", () => setPlaying(true));
    audio.addEventListener("pause", () => setPlaying(false));
    audio.addEventListener("waiting", () => setLoading(true));
    audio.addEventListener("playing", () => setLoading(false));

    return () => {
      // Next.js keeps hidden routes mounted (Activity); never keep playing off-screen.
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
      chunkRef.current = -1;
      setPlaying(false);
    };
  }, [hasAudio, load]);

  const findChunk = (t: number) => {
    const list = sortedRef.current;
    const inside = list.findIndex((c) => t >= c.startTime && t < c.endTime);
    if (inside >= 0) return inside;
    const after = list.findIndex((c) => c.startTime > t); // inside a gap → next available audio
    return after >= 0 ? after : list.length - 1;
  };

  const seek = useCallback(
    (t: number, opts?: { play?: boolean }) => {
      const target = Math.max(0, Math.min(t, total));
      setCurrentTime(target);
      const audio = audioRef.current;
      if (!audio) return;
      const idx = findChunk(target);
      const chunk = sortedRef.current[idx];
      if (!chunk) return;
      const offset = Math.max(0, target - chunk.startTime);
      const shouldPlay = opts?.play ?? !audio.paused;
      if (idx === chunkRef.current && audio.readyState >= 1) {
        audio.currentTime = offset;
        if (shouldPlay) void audio.play().catch(() => undefined);
      } else {
        load(idx, offset, shouldPlay);
      }
    },
    [load, total],
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (chunkRef.current < 0) {
      seek(currentTime, { play: true });
      return;
    }
    if (audio.paused) void audio.play().catch(() => undefined);
    else audio.pause();
  }, [currentTime, seek]);

  const skip = useCallback((delta: number) => seek(currentTime + delta), [currentTime, seek]);

  const cycleRate = useCallback(() => {
    setRate((r) => {
      const next = RATES[(RATES.indexOf(r as (typeof RATES)[number]) + 1) % RATES.length]!;
      if (audioRef.current) audioRef.current.playbackRate = next;
      return next;
    });
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      if (audioRef.current) audioRef.current.muted = !m;
      return !m;
    });
  }, []);

  const value = useMemo<PlayerState>(
    () => ({
      hasAudio,
      playing,
      loading,
      error,
      currentTime,
      duration: total,
      rate,
      muted,
      toggle,
      seek,
      skip,
      cycleRate,
      toggleMute,
    }),
    [hasAudio, playing, loading, error, currentTime, total, rate, muted, toggle, seek, skip, cycleRate, toggleMute],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
