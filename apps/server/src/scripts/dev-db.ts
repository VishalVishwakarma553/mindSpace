/**
 * Starts a persistent local MongoDB for development using a downloaded, version-pinned binary.
 * Useful when no MongoDB service is installed (or the installed one is incompatible with the OS).
 * Data lives in <repo>/.data/db and survives restarts.
 */
import fs from "node:fs";
import path from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";

const dbPath = path.resolve(import.meta.dirname, "../../../../.data/db");
fs.mkdirSync(dbPath, { recursive: true });

const server = await MongoMemoryServer.create({
  instance: { port: Number(process.env.MONGO_PORT ?? 27017), ip: "127.0.0.1", dbPath, storageEngine: "wiredTiger" },
  binary: { version: process.env.MONGO_VERSION ?? "7.0.14" },
});

console.log(`MongoDB ready at ${server.getUri()} (data: ${dbPath})`);

const stop = async () => {
  await server.stop({ doCleanup: false });
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
