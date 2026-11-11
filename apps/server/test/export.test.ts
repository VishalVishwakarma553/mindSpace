import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { buildBlocks, exportFileName, toMarkdown, toText, writePdf, type ExportInput } from "../src/services/export.js";
import { buildFollowUpEmail } from "../src/services/followup.js";

const input: ExportInput = {
  meeting: { title: "Monthly Evaluation - Q2 2026", startedAt: new Date("2026-05-12T13:40:00Z"), duration: 7200 },
  notes: {
    executiveSummary: "Reviewed the SaaS landing page.",
    decisions: [{ description: "Adopt Shadcn UI kit", timestamp: 65 }],
    actionItems: [
      { task: "Audit components", assignedTo: "Kristin", deadline: new Date("2026-05-28"), status: "open" },
      { task: "Create account", status: "done" },
    ],
    nextSteps: ["Prototype hero in Framer"],
  },
  segments: [{ startTime: 65, speaker: "Cameron", text: "Let's adopt the Shadcn kit." }],
};

describe("export", () => {
  it("renders markdown with timestamps and task state", () => {
    const md = toMarkdown(buildBlocks(input, "all"));
    expect(md).toContain("# Monthly Evaluation - Q2 2026");
    expect(md).toContain("- Adopt Shadcn UI kit [01:05]");
    expect(md).toContain("- [ ] Audit components — Kristin (due 2026-05-28)");
    expect(md).toContain("- [x] Create account");
    expect(md).toContain("[01:05] Cameron: Let's adopt the Shadcn kit.");
  });

  it("limits output to the requested section", () => {
    const txt = toText(buildBlocks(input, "actions"));
    expect(txt).toContain("Action Items");
    expect(txt).not.toContain("Executive Summary");
    expect(txt).not.toContain("Transcript");
  });

  it("produces a valid PDF stream", async () => {
    const out = new PassThrough();
    const chunks: Buffer[] = [];
    out.on("data", (c: Buffer) => chunks.push(c));
    const done = new Promise((r) => out.on("end", r));
    writePdf(buildBlocks(input, "all"), out);
    await done;
    expect(Buffer.concat(chunks).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("slugifies file names", () => {
    expect(exportFileName("Monthly Evaluation - Q2 2026", "pdf")).toBe("monthly-evaluation-q2-2026.pdf");
  });

  it("drafts a follow-up email with only open tasks", () => {
    const email = buildFollowUpEmail(input);
    expect(email.subject).toBe("Follow-up: Monthly Evaluation - Q2 2026");
    expect(email.body).toContain("Audit components (owner: Kristin) (due: 2026-05-28)");
    expect(email.body).not.toContain("Create account");
  });
});
