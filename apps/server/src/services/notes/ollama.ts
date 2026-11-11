import { env } from "../../config/env.js";
import type { ChatMessage } from "./prompts.js";

/** Minimal LLM contract so the generator can be tested without a running model. */
export type JsonLlm = (messages: ChatMessage[], jsonSchema: object) => Promise<unknown>;

export class LlmUnavailableError extends Error {
  override name = "LlmUnavailableError";
}

/** Ollama /api/chat with structured outputs (format = JSON schema). Runs fully locally. */
export function ollamaJsonLlm(model: string): JsonLlm {
  return async (messages, jsonSchema) => {
    let res: Response;
    try {
      res = await fetch(`${env.OLLAMA_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          format: jsonSchema,
          options: { temperature: 0.1, num_ctx: 8192 },
        }),
        signal: AbortSignal.timeout(env.OLLAMA_TIMEOUT_MS),
      });
    } catch (err) {
      throw new LlmUnavailableError(
        `Cannot reach Ollama at ${env.OLLAMA_URL}. Is it running? (${(err as Error).message})`,
      );
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 404) {
        throw new LlmUnavailableError(`Model "${model}" is not installed. Run: ollama pull ${model}`);
      }
      throw new Error(`Ollama error ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as { message?: { content?: string } };
    const content = data.message?.content ?? "";
    try {
      return JSON.parse(content);
    } catch {
      throw new Error("Model returned invalid JSON");
    }
  };
}

export async function ollamaStatus(): Promise<{ reachable: boolean; models: string[] }> {
  try {
    const res = await fetch(`${env.OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return { reachable: false, models: [] };
    const data = (await res.json()) as { models?: { name: string }[] };
    return { reachable: true, models: (data.models ?? []).map((m) => m.name) };
  } catch {
    return { reachable: false, models: [] };
  }
}
