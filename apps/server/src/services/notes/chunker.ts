export interface Segment {
  startTime: number;
  endTime: number;
  speaker?: string | null;
  text: string;
}

export interface TranscriptSection {
  startTime: number;
  endTime: number;
  text: string;
}

/** 3725 -> "1:02:05", 65 -> "01:05" */
export function formatTimestamp(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Render a segment as a grounded line: "[t=125] [02:05] Speaker: text". */
export function segmentLine(seg: Segment): string {
  const who = seg.speaker?.trim() ? `${seg.speaker.trim()}: ` : "";
  return `[t=${Math.floor(seg.startTime)}] [${formatTimestamp(seg.startTime)}] ${who}${seg.text.trim()}`;
}

/**
 * Split a transcript into sections no larger than maxChars so each fits a small local
 * model's context window (PRD §12 "LLM context limitations"). Segments are never split.
 */
export function splitIntoSections(segments: Segment[], maxChars = 12_000): TranscriptSection[] {
  const sections: TranscriptSection[] = [];
  let lines: string[] = [];
  let size = 0;
  let start = 0;
  let end = 0;

  for (const seg of segments) {
    if (!seg.text.trim()) continue;
    const line = segmentLine(seg);
    if (lines.length > 0 && size + line.length + 1 > maxChars) {
      sections.push({ startTime: start, endTime: end, text: lines.join("\n") });
      lines = [];
      size = 0;
    }
    if (lines.length === 0) start = seg.startTime;
    lines.push(line);
    size += line.length + 1;
    end = seg.endTime;
  }
  if (lines.length) sections.push({ startTime: start, endTime: end, text: lines.join("\n") });
  return sections;
}
