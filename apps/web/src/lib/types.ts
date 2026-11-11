export type MeetingStatus = "recording" | "paused" | "interrupted" | "processing" | "completed" | "failed";
export type ProcessingStage = "none" | "queued" | "transcribing" | "summarizing" | "done" | "failed";

export interface User {
  id: string;
  name: string;
  email: string;
  preferences: {
    transcriptionModel: string;
    summarizationModel: string;
    storageMode: string;
    captureMicrophone: boolean;
    deleteAudioAfterProcessing: boolean;
  };
}

export interface Meeting {
  id: string;
  title: string;
  platform: string;
  meetingUrl: string;
  tags: string[];
  participants: string[];
  status: MeetingStatus;
  processingStage: ProcessingStage;
  processingError: string;
  progress: { done: number; total: number };
  startedAt: string;
  endedAt: string | null;
  duration: number;
  expectedChunks: number;
  missingChunks: number[];
  audioDeleted: boolean;
  summary?: string;
  actionItemCount?: number;
  openActionItemCount?: number;
}

export interface Segment {
  startTime: number;
  endTime: number;
  speaker: string;
  text: string;
}

export interface ActionItem {
  _id: string;
  task: string;
  assignedTo: string;
  deadline: string | null;
  deadlineText: string;
  status: "open" | "done";
  timestamp: number | null;
  uncertain: boolean;
  source: "ai" | "user";
}

export interface Decision {
  _id?: string;
  description: string;
  timestamp: number | null;
}

export interface DiscussionPoint {
  topic: string;
  details: string;
  timestamp: number | null;
}

export interface MeetingNotes {
  id: string;
  objective: string;
  executiveSummary: string;
  discussionPoints: DiscussionPoint[];
  decisions: Decision[];
  suggestions: string[];
  actionItems: ActionItem[];
  pendingQuestions: string[];
  technicalDetails: {
    bugs: string[];
    proposedSolutions: string[];
    architectureChanges: string[];
    dependencies: string[];
    implementationDecisions: string[];
  };
  nextSteps: string[];
  uncertainties: string[];
  model: string;
  editedByUser: boolean;
  updatedAt: string;
}

export interface AudioChunk {
  index: number;
  startTime: number;
  endTime: number;
  duration: number;
  fileSize: number;
  status: string;
}

export interface MeetingDetail {
  meeting: Meeting;
  notes: MeetingNotes | null;
  transcript: { segments: Segment[]; language: string; status: "partial" | "complete" } | null;
  audio: AudioChunk[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export interface Stats {
  totalMeetings: number;
  totalDuration: number;
  openActionItems: number;
  recent: Meeting[];
  active: Meeting[];
}

export interface SearchResult {
  meeting: Meeting;
  titleMatch: boolean;
  moments: { startTime: number; speaker: string; text: string }[];
  tasks: string[];
  decisions: string[];
}

export interface GlobalActionItem {
  id: string;
  meetingId: string;
  meetingTitle: string;
  meetingDate: string;
  task: string;
  assignedTo: string;
  deadline: string | null;
  deadlineText: string;
  status: "open" | "done";
  uncertain: boolean;
  timestamp: number | null;
}

export interface SystemStatus {
  database: { connected: boolean };
  ollama: { reachable: boolean; models: string[]; url: string; model: string; modelInstalled: boolean };
  worker: { online: boolean; lastSeenAt: string | null };
  disk: { freeBytes: number | null; minFreeBytes: number };
}
