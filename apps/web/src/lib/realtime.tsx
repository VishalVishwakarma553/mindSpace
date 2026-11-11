"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { keys } from "./queries";
import type { MeetingDetail, MeetingStatus } from "./types";

export interface AppNotification {
  id: string;
  meetingId: string;
  title: string;
  description: string;
  kind: "success" | "error" | "info";
  at: number;
  read: boolean;
}

interface RealtimeContextValue {
  connected: boolean;
  notifications: AppNotification[];
  markAllRead: () => void;
}

const RealtimeContext = createContext<RealtimeContextValue>({ connected: false, notifications: [], markAllRead: () => {} });

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000/ws";

interface MeetingEvent {
  type: "meeting.updated" | "meeting.deleted";
  meetingId: string;
  data?: { status?: MeetingStatus; processingError?: string };
}

/**
 * Keeps the dashboard live while the pipeline runs: patches cached meeting data,
 * invalidates lists, and turns terminal transitions into toasts + bell notifications.
 * Reconnects with capped exponential backoff.
 */
export function RealtimeProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const lastStatus = useRef(new Map<string, MeetingStatus>());

  const notify = useCallback((n: Omit<AppNotification, "id" | "at" | "read">) => {
    setNotifications((list) => [{ ...n, id: crypto.randomUUID(), at: Date.now(), read: false }, ...list].slice(0, 20));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let ws: WebSocket | null = null;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const handle = (event: MeetingEvent) => {
      if (event.type === "meeting.deleted") {
        void qc.invalidateQueries({ queryKey: ["meetings"] });
        return;
      }
      const cached = qc.getQueryData<MeetingDetail>(keys.meeting(event.meetingId));
      if (cached && event.data) {
        qc.setQueryData<MeetingDetail>(keys.meeting(event.meetingId), {
          ...cached,
          meeting: { ...cached.meeting, ...event.data },
        });
      }
      const status = event.data?.status;
      const previous = lastStatus.current.get(event.meetingId) ?? cached?.meeting.status;
      if (status) lastStatus.current.set(event.meetingId, status);

      if (status && status !== previous && (status === "completed" || status === "failed")) {
        void qc.invalidateQueries({ queryKey: keys.meeting(event.meetingId) });
        const title = cached?.meeting.title ?? "Your meeting";
        if (status === "completed") {
          toast.success("Meeting notes are ready", { description: title });
          notify({ meetingId: event.meetingId, title: "Notes ready", description: title, kind: "success" });
        } else {
          toast.error("Processing failed", { description: event.data?.processingError || title });
          notify({
            meetingId: event.meetingId,
            title: "Processing failed",
            description: event.data?.processingError || title,
            kind: "error",
          });
        }
      }
      void qc.invalidateQueries({ queryKey: ["meetings"] });
      void qc.invalidateQueries({ queryKey: keys.stats });
    };

    const connect = () => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => {
        retry = 0;
        setConnected(true);
      };
      ws.onmessage = (msg) => {
        try {
          handle(JSON.parse(String(msg.data)) as MeetingEvent);
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (disposed) return;
        timer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** retry++));
      };
    };
    connect();
    return () => {
      disposed = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, [enabled, qc, notify]);

  const markAllRead = useCallback(() => setNotifications((list) => list.map((n) => ({ ...n, read: true }))), []);
  const value = useMemo(() => ({ connected, notifications, markAllRead }), [connected, notifications, markAllRead]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export const useRealtime = () => useContext(RealtimeContext);
