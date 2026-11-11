import { MongoMemoryServer } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

/** Use TEST_MONGODB_URI when given, otherwise an ephemeral in-memory MongoDB. */
export default async function setup(project: TestProject) {
  if (process.env.TEST_MONGODB_URI) {
    project.provide("mongoUri", process.env.TEST_MONGODB_URI);
    return;
  }
  const server = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
  project.provide("mongoUri", server.getUri("meetmind_test"));
  return async () => {
    await server.stop();
  };
}
