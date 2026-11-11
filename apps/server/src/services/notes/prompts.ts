import { formatTimestamp, type TranscriptSection } from "./chunker.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** PRD §5.5 "AI Accuracy Requirements", encoded as non-negotiable rules. */
export const SYSTEM_PROMPT = `You are MeetMind, an assistant that writes accurate, structured meeting notes from a transcript.

Strict rules:
1. Use ONLY information present in the transcript. Never invent decisions, tasks, owners, deadlines, names or numbers.
2. A decision is only something the participants clearly agreed or finalized. Proposals, ideas and "maybe we should" go in "suggestions".
3. Set "assignedTo" only when a person is explicitly named or clearly volunteers ("I'll do it" with a known speaker). Otherwise use "".
4. Set "deadlineText" to the deadline phrase exactly as spoken. Set "deadline" (YYYY-MM-DD) only when a calendar date was stated. Otherwise "".
5. Every line of the transcript starts with [t=SECONDS]. For each item, set "timestamp" to the SECONDS value of the line that supports it.
6. Preserve technical terms, product names and identifiers exactly as written.
7. Mark "uncertain": true and add a note to "uncertainties" when something is ambiguous, inaudible or contradictory.
8. Prefer short, concrete phrasing. Use empty arrays when a category has nothing.
Respond with JSON only.`;

export function sectionPrompt(
  section: TranscriptSection,
  index: number,
  total: number,
  meetingTitle: string,
): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Meeting: "${meetingTitle}"
Transcript section ${index + 1} of ${total} (${formatTimestamp(section.startTime)} – ${formatTimestamp(section.endTime)}).
Extract notes for THIS section only. The executiveSummary should summarize this section.

<transcript>
${section.text}
</transcript>`,
    },
  ];
}

export function reducePrompt(partialsJson: string, meetingTitle: string): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Meeting: "${meetingTitle}"
Below are notes extracted from consecutive sections of one meeting, as a JSON array in chronological order.
Merge them into ONE set of notes for the whole meeting:
- Write a single executiveSummary covering the entire meeting.
- Merge duplicate topics, decisions and action items; keep the earliest timestamp.
- If a later section reverses an earlier decision, keep only the final decision and mention the change in uncertainties.
- Do not add anything that is not in the section notes.

<section_notes>
${partialsJson}
</section_notes>`,
    },
  ];
}
