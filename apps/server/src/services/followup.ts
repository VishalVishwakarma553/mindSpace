import { formatDuration, type ExportInput } from "./export.js";

/**
 * Draft a follow-up email from the structured notes (PRD §13 productivity feature).
 * Deterministic: it only restates what is already in the notes, so it cannot hallucinate.
 */
export function buildFollowUpEmail(input: Pick<ExportInput, "meeting" | "notes">): { subject: string; body: string } {
  const { meeting, notes } = input;
  const date = meeting.startedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const lines: string[] = ["Hi all,", "", `Thanks for joining "${meeting.title}" on ${date} (${formatDuration(meeting.duration)}). Here is a quick recap.`];

  const section = (title: string, items: string[] | undefined) => {
    if (!items?.length) return;
    lines.push("", `${title}:`, ...items.map((i) => `• ${i}`));
  };

  if (notes?.executiveSummary) lines.push("", "Summary:", notes.executiveSummary);
  section("Decisions", notes?.decisions?.map((d) => d.description));
  section(
    "Action items",
    notes?.actionItems
      ?.filter((a) => a.status !== "done")
      .map((a) => {
        const due = a.deadline ? new Date(a.deadline).toISOString().slice(0, 10) : a.deadlineText;
        return [a.task, a.assignedTo && `(owner: ${a.assignedTo})`, due && `(due: ${due})`].filter(Boolean).join(" ");
      }),
  );
  section("Open questions", notes?.pendingQuestions);
  section("Next steps", notes?.nextSteps);
  lines.push("", "Please reply if anything is missing or incorrect.", "", "Best regards");

  return { subject: `Follow-up: ${meeting.title}`, body: lines.join("\n") };
}
