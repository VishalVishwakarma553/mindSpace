import { describe, expect, it, vi } from "vitest";
import { formatTimestamp, splitIntoSections, type Segment } from "../src/services/notes/chunker.js";
import { generateNotes, groundNotes, mergeNotes } from "../src/services/notes/generator.js";
import { emptyNotes, type LlmNotes } from "../src/services/notes/schema.js";

const segments: Segment[] = [
  { startTime: 0, endTime: 8, speaker: "Cameron", text: "Let's finalize the Shadcn UI kit audit this sprint." },
  { startTime: 8, endTime: 15, speaker: "Brooklyn", text: "I'll set up Wise and PayPal for Gumroad by 2026-05-28." },
  { startTime: 15, endTime: 22, speaker: "Kristin", text: "Maybe we should try Framer for the hero prototype?" },
];

describe("chunker", () => {
  it("formats timestamps", () => {
    expect(formatTimestamp(65)).toBe("01:05");
    expect(formatTimestamp(3725)).toBe("1:02:05");
  });

  it("splits into bounded sections without breaking segments", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ startTime: i * 10, endTime: i * 10 + 9, text: "x".repeat(100) }));
    const sections = splitIntoSections(many, 1000);
    expect(sections.length).toBeGreaterThan(1);
    for (const s of sections) expect(s.text.length).toBeLessThanOrEqual(1000);
    expect(sections[0]!.startTime).toBe(0);
    expect(sections.at(-1)!.endTime).toBe(499);
  });
});

describe("groundNotes", () => {
  it("drops owners and deadlines that have no evidence in the transcript", () => {
    const notes: LlmNotes = {
      ...emptyNotes(),
      actionItems: [
        { task: "Set up Wise", assignedTo: "Brooklyn", deadlineText: "by 2026-05-28", deadline: "2026-05-28", timestamp: 8, uncertain: false },
        { task: "Write docs", assignedTo: "Jordan", deadlineText: "", deadline: "2026-06-01", timestamp: 999, uncertain: false },
        { task: "set up wise", assignedTo: "", deadlineText: "", deadline: "", timestamp: null, uncertain: false },
      ],
    };
    const grounded = groundNotes(notes, segments);
    expect(grounded.actionItems).toHaveLength(2); // duplicate removed
    expect(grounded.actionItems[0]).toMatchObject({ assignedTo: "Brooklyn", deadline: "2026-05-28", timestamp: 8 });
    // Invented owner, unspoken deadline and out-of-range timestamp are all removed.
    expect(grounded.actionItems[1]).toMatchObject({ assignedTo: "", deadline: "", timestamp: null, uncertain: true });
  });
});

describe("generateNotes", () => {
  const partial = (summary: string): LlmNotes => ({ ...emptyNotes(), executiveSummary: summary, nextSteps: [summary] });

  it("uses a single call for short transcripts", async () => {
    const llm = vi.fn().mockResolvedValue(partial("Short meeting."));
    const notes = await generateNotes({ segments, meetingTitle: "Sync", llm });
    expect(llm).toHaveBeenCalledTimes(1);
    expect(notes.executiveSummary).toBe("Short meeting.");
  });

  it("map-reduces long transcripts and falls back to a deterministic merge if reduce fails", async () => {
    const long = Array.from({ length: 30 }, (_, i) => ({ startTime: i * 10, endTime: i * 10 + 9, text: `point ${i} `.repeat(20) }));
    let call = 0;
    const llm = vi.fn(async () => {
      call++;
      if (call <= 3) return partial(`Part ${call}.`);
      return { not: "valid" }; // reduce step returns garbage twice
    });
    const notes = await generateNotes({ segments: long, meetingTitle: "Long", llm, maxSectionChars: 2500 });
    expect(notes.executiveSummary).toBe("Part 1. Part 2. Part 3.");
    expect(notes.nextSteps).toEqual(["Part 1.", "Part 2.", "Part 3."]);
  });

  it("reports empty recordings instead of inventing content", async () => {
    const llm = vi.fn();
    const notes = await generateNotes({ segments: [], meetingTitle: "Silent", llm });
    expect(llm).not.toHaveBeenCalled();
    expect(notes.uncertainties[0]).toMatch(/No speech/);
  });

  it("mergeNotes concatenates technical details", () => {
    const a = emptyNotes();
    a.technicalDetails.bugs.push("Bug A");
    const b = emptyNotes();
    b.technicalDetails.bugs.push("Bug B");
    expect(mergeNotes([a, b]).technicalDetails.bugs).toEqual(["Bug A", "Bug B"]);
  });
});
