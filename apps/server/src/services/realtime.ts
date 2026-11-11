import type { IncomingMessage, Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { AUTH_COOKIE, verifyToken } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";

export interface RealtimeEvent {
  type: "meeting.updated" | "meeting.deleted";
  meetingId: string;
  data?: Record<string, unknown>;
}

const sockets = new Map<string, Set<WebSocket>>();

function cookieValue(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

function authenticate(req: IncomingMessage): string | null {
  const token = cookieValue(req.headers.cookie, AUTH_COOKIE);
  return token ? verifyToken(token) : null;
}

/** WebSocket hub at /ws: pushes processing progress to the dashboard (PRD §6.1 REST + WebSockets). */
export function attachRealtime(server: Server, allowedOrigins: string[]): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const origin = req.headers.origin ?? "";
    const userId = authenticate(req);
    if (url.pathname !== "/ws" || !userId || (origin && !allowedOrigins.includes(origin))) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const set = sockets.get(userId) ?? new Set();
      set.add(ws);
      sockets.set(userId, set);
      ws.on("close", () => {
        set.delete(ws);
        if (set.size === 0) sockets.delete(userId);
      });
      ws.on("error", (err) => logger.debug({ err }, "ws error"));
    });
  });

  // Keep idle connections alive through proxies.
  setInterval(() => {
    for (const set of sockets.values()) for (const ws of set) ws.ping();
  }, 30_000).unref();
}

export function publish(userId: string, event: RealtimeEvent): void {
  const set = sockets.get(userId);
  if (!set) return;
  const payload = JSON.stringify(event);
  for (const ws of set) if (ws.readyState === ws.OPEN) ws.send(payload);
}
