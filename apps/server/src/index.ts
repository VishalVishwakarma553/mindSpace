import http from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDb, disconnectDb } from "./db/connect.js";
import { logger } from "./lib/logger.js";
import { startSummarizeRunner, startSweeper } from "./services/processing.js";
import { attachRealtime } from "./services/realtime.js";
import { ensureStorageRoot } from "./services/storage.js";

async function main() {
  await ensureStorageRoot();
  await connectDb(env.MONGODB_URI);

  const server = http.createServer(createApp());
  attachRealtime(server, [env.WEB_ORIGIN]);
  const stopRunner = startSummarizeRunner();
  const stopSweeper = startSweeper();

  server.listen(env.PORT, () => logger.info(`MeetMind API listening on http://localhost:${env.PORT}`));

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down");
    stopRunner();
    stopSweeper();
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.fatal({ err }, "Failed to start");
  process.exit(1);
});
