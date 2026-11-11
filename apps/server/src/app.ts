import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { requireAuth, requireWorker } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { authRouter } from "./routes/auth.js";
import { insightsRouter } from "./routes/insights.js";
import { internalRouter } from "./routes/internal.js";
import { meetingsRouter } from "./routes/meetings.js";
import { notesRouter } from "./routes/notes.js";
import { recordingRouter } from "./routes/recording.js";
import { usersRouter } from "./routes/users.js";

/** Origins allowed to call the API with credentials: the dashboard and the MeetMind extension. */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // same-origin, curl, Python worker
  if (origin === env.WEB_ORIGIN) return true;
  if (origin.startsWith("chrome-extension://")) {
    const id = origin.slice("chrome-extension://".length);
    return env.EXTENSION_IDS.length ? env.EXTENSION_IDS.includes(id) : env.NODE_ENV !== "production";
  }
  return false;
}

export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", "loopback");

  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
  app.use(
    cors({
      origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
      credentials: true,
    }),
  );
  if (env.NODE_ENV !== "test") app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));
  app.use(express.json({ limit: "5mb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/internal", requireWorker, internalRouter);
  app.use("/api/users", requireAuth, usersRouter);
  app.use("/api/meetings", requireAuth, recordingRouter, notesRouter, meetingsRouter);
  app.use("/api", requireAuth, insightsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
