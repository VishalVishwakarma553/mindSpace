import { logger } from "../../lib/logger.js";
import { splitIntoSections, type Segment } from "./chunker.js";
import type { JsonLlm } from "./ollama.js";
import { reducePrompt, sectionPrompt, type ChatMessage } from "./prompts.js";
import { emptyNotes, llmNotesJsonSchema, llmNotesSchema, type LlmNotes } from "./schema.js";

export interface GenerateOptions {
  segments: Segment[];
  meetingTitle: string;
  llm: JsonLlm;
  maxSectionChars?: number;
  onProgress?: (done: number, total: number) => void;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function callValidated(llm: JsonLlm, messages: ChatMessage[]): Promise<LlmNotes> {
  let lastError: unknown;
  // One retry: small local models occasionally emit schema-violating JSON.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await llm(messages, llmNotesJsonSchema);
      const parsed = llmNotesSchema.safeParse(raw);
      if (parsed.success) return parsed.data;
      lastError = new Error(`Model output failed validation: ${parsed.error.issues[0]?.message}`);
    } catch (err) {
      if ((err as Error).name === "LlmUnavailableError") throw err;
      lastError = err;
    }
  }
  throw lastError;
}

/** Deterministic merge used when the reduce step fails, so completed section work is never lost. */
export function mergeNotes(parts: LlmNotes[]): LlmNotes {
  const out = emptyNotes();
  for (const p of parts) {
    out.objective ||= p.objective;
    out.discussionPoints.push(...p.discussionPoints);
    out.decisions.push(...p.decisions);
    out.suggestions.push(...p.suggestions);
    out.actionItems.push(...p.actionItems);
    out.pendingQuestions.push(...p.pendingQuestions);
    out.nextSteps.push(...p.nextSteps);
    out.uncertainties.push(...p.uncertainties);
    for (const k of Object.keys(out.technicalDetails) as (keyof LlmNotes["technicalDetails"])[]) {
      out.technicalDetails[k].push(...p.technicalDetails[k]);
    }
  }
  out.executiveSummary = parts
    .map((p) => p.executiveSummary.trim())
    .filter(Boolean)
    .join(" ");
  return out;
}

/**
 * Enforce PRD accuracy rules on whatever the model produced:
 * - timestamps must point inside the transcript
 * - owners must actually appear in the transcript (no assignment without evidence)
 * - calendar deadlines require a spoken deadline phrase and a valid ISO date
 */
export function groundNotes(notes: LlmNotes, segments: Segment[]): LlmNotes {
  const maxTime = segments.reduce((m, s) => Math.max(m, s.endTime), 0);
  const corpus = norm(segments.map((s) => `${s.speaker ?? ""} ${s.text}`).join(" "));
  const validTs = (t: number | null) =>
    t !== null && Number.isFinite(t) && t >= 0 && t <= maxTime + 1 ? Math.floor(t) : null;
  const mentioned = (name: string) => {
    const n = norm(name);
    return n.length > 0 && n.split(" ").some((part) => part.length > 1 && corpus.includes(part));
  };

  const actionItems = dedupeBy(notes.actionItems, (a) => norm(a.task)).map((item) => {
    let { assignedTo, deadline, uncertain } = item;
    if (assignedTo && !mentioned(assignedTo)) {
      assignedTo = "";
      uncertain = true;
    }
    const isoOk = /^\d{4}-\d{2}-\d{2}$/.test(deadline) && !Number.isNaN(Date.parse(deadline));
    if (deadline && (!isoOk || !item.deadlineText.trim())) {
      deadline = "";
      uncertain = uncertain || Boolean(item.deadlineText);
    }
    return { ...item, assignedTo: assignedTo.trim(), deadline, uncertain, timestamp: validTs(item.timestamp) };
  });

  const uniqStrings = (xs: string[]) => dedupeBy(xs.map((x) => x.trim()), norm);

  return {
    ...notes,
    discussionPoints: dedupeBy(notes.discussionPoints, (d) => norm(d.topic)).map((d) => ({
      ...d,
      timestamp: validTs(d.timestamp),
    })),
    decisions: dedupeBy(notes.decisions, (d) => norm(d.description)).map((d) => ({
      ...d,
      timestamp: validTs(d.timestamp),
    })),
    actionItems,
    suggestions: uniqStrings(notes.suggestions),
    pendingQuestions: uniqStrings(notes.pendingQuestions),
    nextSteps: uniqStrings(notes.nextSteps),
    uncertainties: uniqStrings(notes.uncertainties),
    technicalDetails: {
      bugs: uniqStrings(notes.technicalDetails.bugs),
      proposedSolutions: uniqStrings(notes.technicalDetails.proposedSolutions),
      architectureChanges: uniqStrings(notes.technicalDetails.architectureChanges),
      dependencies: uniqStrings(notes.technicalDetails.dependencies),
      implementationDecisions: uniqStrings(notes.technicalDetails.implementationDecisions),
    },
  };
}

/** Map-reduce summarization over transcript sections (PRD §6.3 steps 10–12). */
export async function generateNotes(opts: GenerateOptions): Promise<LlmNotes> {
  const { segments, meetingTitle, llm, onProgress } = opts;
  const sections = splitIntoSections(segments, opts.maxSectionChars);
  if (sections.length === 0) {
    const notes = emptyNotes();
    notes.uncertainties.push("No speech was detected in the recording.");
    return notes;
  }

  const steps = sections.length + (sections.length > 1 ? 1 : 0);
  const partials: LlmNotes[] = [];
  for (const [i, section] of sections.entries()) {
    partials.push(await callValidated(llm, sectionPrompt(section, i, sections.length, meetingTitle)));
    onProgress?.(i + 1, steps);
  }

  let merged: LlmNotes;
  if (partials.length === 1) {
    merged = partials[0]!;
  } else {
    try {
      merged = await callValidated(llm, reducePrompt(JSON.stringify(partials), meetingTitle));
    } catch (err) {
      if ((err as Error).name === "LlmUnavailableError") throw err;
      logger.warn({ err }, "Reduce step failed; using deterministic merge");
      merged = mergeNotes(partials);
    }
    onProgress?.(steps, steps);
  }
  return groundNotes(merged, segments);
}
