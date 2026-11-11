import type { Segment } from "@/lib/types";

export interface Turn {
  speaker: string;
  startTime: number;
  endTime: number;
  text: string;
  /** Indexes into the transcript's segments array (for editing / active matching). */
  segmentIndexes: number[];
}

export const UNKNOWN_SPEAKER = "Speaker";

/** Merge consecutive same-speaker segments into readable turns (gap < maxGap seconds). */
export function toTurns(segments: Segment[], maxGap = 4, maxChars = 900): Turn[] {
  const turns: Turn[] = [];
  segments.forEach((s, i) => {
    const speaker = s.speaker?.trim() || UNKNOWN_SPEAKER;
    const last = turns.at(-1);
    if (last && last.speaker === speaker && s.startTime - last.endTime <= maxGap && last.text.length < maxChars) {
      last.text += ` ${s.text.trim()}`;
      last.endTime = s.endTime;
      last.segmentIndexes.push(i);
    } else {
      turns.push({ speaker, startTime: s.startTime, endTime: s.endTime, text: s.text.trim(), segmentIndexes: [i] });
    }
  });
  return turns;
}

/** Index of the item whose [startTime, nextStart) contains t, via binary search. */
export function activeIndex(items: { startTime: number }[], t: number): number {
  let lo = 0;
  let hi = items.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (items[mid]!.startTime <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

export function speakersOf(segments: Segment[], participants: string[]): string[] {
  const seen = new Set<string>();
  for (const p of participants) if (p.trim()) seen.add(p.trim());
  for (const s of segments) if (s.speaker?.trim()) seen.add(s.speaker.trim());
  return [...seen];
}
