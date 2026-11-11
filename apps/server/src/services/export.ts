import PDFDocument from "pdfkit";
import type { Writable } from "node:stream";
import { formatTimestamp } from "./notes/chunker.js";

export const EXPORT_FORMATS = ["md", "txt", "pdf"] as const;
export const EXPORT_SECTIONS = ["all", "summary", "transcript", "actions"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export type ExportSection = (typeof EXPORT_SECTIONS)[number];

export interface ActionItemInput {
  task: string;
  assignedTo?: string | null;
  deadline?: Date | null;
  deadlineText?: string | null;
  status?: string | null;
  uncertain?: boolean | null;
}

export interface ExportInput {
  meeting: { title: string; startedAt: Date; duration: number; meetingUrl?: string | null; participants?: string[] };
  notes: {
    objective?: string | null;
    executiveSummary?: string | null;
    discussionPoints?: { topic?: string | null; details?: string | null; timestamp?: number | null }[];
    decisions?: { description: string; timestamp?: number | null }[];
    suggestions?: string[];
    actionItems?: ActionItemInput[];
    pendingQuestions?: string[];
    technicalDetails?: Record<string, string[] | undefined> | null;
    nextSteps?: string[];
    uncertainties?: string[];
  } | null;
  segments: { startTime: number; speaker?: string | null; text: string }[];
}

/** Format-neutral document model: every exporter renders the same blocks. */
type Block =
  | { kind: "h1" | "h2" | "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "meta"; items: [string, string][] };

const TECH_LABELS: Record<string, string> = {
  bugs: "Bugs discussed",
  proposedSolutions: "Proposed solutions",
  architectureChanges: "API / architecture changes",
  dependencies: "Technical dependencies",
  implementationDecisions: "Implementation decisions",
};

const at = (t?: number | null) => (t === null || t === undefined ? "" : ` [${formatTimestamp(t)}]`);

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

function actionLine(a: ActionItemInput) {
  const parts = [a.status === "done" ? "[x]" : "[ ]", a.task];
  if (a.assignedTo) parts.push(`— ${a.assignedTo}`);
  const due = a.deadline ? new Date(a.deadline).toISOString().slice(0, 10) : a.deadlineText;
  if (due) parts.push(`(due ${due})`);
  if (a.uncertain) parts.push("(needs confirmation)");
  return parts.join(" ");
}

export function buildBlocks(input: ExportInput, section: ExportSection): Block[] {
  const { meeting, notes, segments } = input;
  const blocks: Block[] = [{ kind: "h1", text: meeting.title }];
  const meta: [string, string][] = [
    ["Date", meeting.startedAt.toISOString().replace("T", " ").slice(0, 16) + " UTC"],
    ["Duration", formatDuration(meeting.duration)],
  ];
  if (meeting.meetingUrl) meta.push(["Link", meeting.meetingUrl]);
  if (meeting.participants?.length) meta.push(["Participants", meeting.participants.join(", ")]);
  blocks.push({ kind: "meta", items: meta });

  const want = (s: ExportSection) => section === "all" || section === s;
  const list = (title: string, items: string[] | undefined) => {
    if (items?.length) blocks.push({ kind: "h2", text: title }, { kind: "list", items });
  };

  if (notes && want("summary")) {
    if (notes.objective) blocks.push({ kind: "h2", text: "Objective" }, { kind: "p", text: notes.objective });
    if (notes.executiveSummary) {
      blocks.push({ kind: "h2", text: "Executive Summary" }, { kind: "p", text: notes.executiveSummary });
    }
    list(
      "Key Discussion Points",
      notes.discussionPoints?.map((d) => `${d.topic ?? ""}: ${d.details ?? ""}${at(d.timestamp)}`),
    );
    list("Decisions", notes.decisions?.map((d) => `${d.description}${at(d.timestamp)}`));
    list("Suggestions (not finalized)", notes.suggestions);
  }
  if (notes && want("actions")) list("Action Items", notes.actionItems?.map(actionLine));
  if (notes && want("summary")) {
    list("Pending Questions", notes.pendingQuestions);
    for (const [key, label] of Object.entries(TECH_LABELS)) list(label, notes.technicalDetails?.[key]);
    list("Next Steps", notes.nextSteps);
    list("Uncertain / Needs Review", notes.uncertainties);
  }
  if (want("transcript") && segments.length) {
    blocks.push({ kind: "h2", text: "Transcript" });
    for (const s of segments) {
      blocks.push({ kind: "p", text: `[${formatTimestamp(s.startTime)}] ${s.speaker ? `${s.speaker}: ` : ""}${s.text}` });
    }
  }
  return blocks;
}

export function toMarkdown(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.kind) {
        case "h1":
          return `# ${b.text}`;
        case "h2":
          return `## ${b.text}`;
        case "p":
          return b.text;
        case "list":
          return b.items.map((i) => `- ${i}`).join("\n");
        case "meta":
          return b.items.map(([k, v]) => `**${k}:** ${v}  `).join("\n");
      }
    })
    .join("\n\n")
    .concat("\n");
}

export function toText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.kind) {
        case "h1":
          return `${b.text.toUpperCase()}\n${"=".repeat(Math.min(80, b.text.length))}`;
        case "h2":
          return `${b.text}\n${"-".repeat(b.text.length)}`;
        case "p":
          return b.text;
        case "list":
          return b.items.map((i) => `  • ${i}`).join("\n");
        case "meta":
          return b.items.map(([k, v]) => `${k}: ${v}`).join("\n");
      }
    })
    .join("\n\n")
    .concat("\n");
}

export function writePdf(blocks: Block[], out: Writable): void {
  const doc = new PDFDocument({ margin: 56, size: "A4", info: { Title: blocks[0]?.kind === "h1" ? blocks[0].text : "Meeting notes" } });
  doc.pipe(out);
  for (const b of blocks) {
    switch (b.kind) {
      case "h1":
        doc.font("Helvetica-Bold").fontSize(20).fillColor("#111").text(b.text).moveDown(0.5);
        break;
      case "h2":
        doc.moveDown(0.6).font("Helvetica-Bold").fontSize(13).fillColor("#111").text(b.text).moveDown(0.3);
        break;
      case "p":
        doc.font("Helvetica").fontSize(10.5).fillColor("#333").text(b.text, { lineGap: 2 }).moveDown(0.3);
        break;
      case "list":
        doc.font("Helvetica").fontSize(10.5).fillColor("#333").list(b.items, { bulletRadius: 1.8, lineGap: 2 });
        break;
      case "meta":
        for (const [k, v] of b.items) {
          doc.font("Helvetica-Bold").fontSize(10).fillColor("#555").text(`${k}: `, { continued: true });
          doc.font("Helvetica").text(v);
        }
        break;
    }
  }
  doc.end();
}

export function exportFileName(title: string, format: ExportFormat): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "meeting";
  return `${slug}.${format}`;
}
