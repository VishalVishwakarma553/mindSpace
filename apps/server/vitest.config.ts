import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: "test",
      STORAGE_DIR: path.join(os.tmpdir(), "meetmind-test-storage"),
      WORKER_TOKEN: "test-worker-token-123456",
      JWT_SECRET: "test-jwt-secret-1234567890",
      MIN_FREE_DISK_MB: "0",
    },
  },
});
