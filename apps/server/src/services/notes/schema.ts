import { z } from "zod";

/**
 * Shape the LLM must return. Used both as the Ollama structured-output JSON schema
 * and to validate the response before anything is persisted.
 */
const ts = z.number().nullable().describe("Transcript time in seconds that supports this item, or null");

export const llmNotesSchema = z.object({
  objective: z.string().describe("Meeting objective, empty if unclear"),
  executiveSummary: z.string().describe("3-6 sentence summary of the meeting"),
  discussionPoints: z.array(z.object({ topic: z.string(), details: z.string(), timestamp: ts })),
  decisions: z
    .array(z.object({ description: z.string(), timestamp: ts }))
    .describe("Only decisions explicitly finalized in the conversation"),
  suggestions: z.array(z.string()).describe("Ideas proposed but not agreed"),
  actionItems: z.array(
    z.object({
      task: z.string(),
      assignedTo: z.string().describe("Person explicitly named as owner, else empty string"),
      deadlineText: z.string().describe("Deadline phrase exactly as spoken, else empty string"),
      deadline: z.string().describe("ISO date (YYYY-MM-DD) only if a calendar date was stated, else empty"),
      timestamp: ts,
      uncertain: z.boolean().describe("true if ownership, scope or deadline is ambiguous"),
    }),
  ),
  pendingQuestions: z.array(z.string()),
  technicalDetails: z.object({
    bugs: z.array(z.string()),
    proposedSolutions: z.array(z.string()),
    architectureChanges: z.array(z.string()),
    dependencies: z.array(z.string()),
    implementationDecisions: z.array(z.string()),
  }),
  nextSteps: z.array(z.string()),
  uncertainties: z.array(z.string()).describe("Anything inaudible, ambiguous or contradictory"),
});

export type LlmNotes = z.infer<typeof llmNotesSchema>;

export const llmNotesJsonSchema = z.toJSONSchema(llmNotesSchema);

export const emptyNotes = (): LlmNotes => ({
  objective: "",
  executiveSummary: "",
  discussionPoints: [],
  decisions: [],
  suggestions: [],
  actionItems: [],
  pendingQuestions: [],
  technicalDetails: {
    bugs: [],
    proposedSolutions: [],
    architectureChanges: [],
    dependencies: [],
    implementationDecisions: [],
  },
  nextSteps: [],
  uncertainties: [],
});
