import path from "node:path";
import { z } from "zod";

const DEV_JWT_SECRET = "dev-only-insecure-jwt-secret-change-me";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  EXTENSION_IDS: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/meetmind"),
  STORAGE_DIR: z.string().default("./storage"),
  MIN_FREE_DISK_MB: z.coerce.number().nonnegative().default(500),
  MAX_CHUNK_MB: z.coerce.number().positive().default(60),
  JWT_SECRET: z.string().min(16).default(DEV_JWT_SECRET),
  JWT_TTL: z.string().default("7d"),
  WORKER_TOKEN: z.string().min(16).default("dev-only-worker-token"),
  OLLAMA_URL: z.string().url().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().default("llama3.1:8b"),
  OLLAMA_TIMEOUT_MS: z.coerce.number().positive().default(10 * 60 * 1000),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:", z.prettifyError(parsed.error));
    process.exit(1);
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production" && env.JWT_SECRET === DEV_JWT_SECRET) {
    console.error("JWT_SECRET must be set in production.");
    process.exit(1);
  }
  return { ...env, STORAGE_DIR: path.resolve(env.STORAGE_DIR) };
}

export const env = load();
