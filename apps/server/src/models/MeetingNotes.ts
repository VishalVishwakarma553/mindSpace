import { Schema, model, type InferSchemaType } from "mongoose";

const actionItemSchema = new Schema({
  task: { type: String, required: true, trim: true },
  assignedTo: { type: String, default: "" }, // only when explicitly identifiable
  deadline: { type: Date, default: null }, // only when explicitly mentioned
  deadlineText: { type: String, default: "" }, // verbatim phrase, e.g. "by next Friday"
  status: { type: String, enum: ["open", "done"], default: "open" },
  timestamp: { type: Number, default: null }, // transcript evidence (seconds)
  uncertain: { type: Boolean, default: false },
  source: { type: String, enum: ["ai", "user"], default: "ai" },
});

const decisionSchema = new Schema({
  description: { type: String, required: true, trim: true },
  timestamp: { type: Number, default: null },
});

const notesSchema = new Schema(
  {
    meetingId: { type: Schema.Types.ObjectId, ref: "Meeting", required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    objective: { type: String, default: "" },
    overview: { type: String, default: "" },
    executiveSummary: { type: String, default: "" },
    discussionPoints: {
      type: [{ topic: String, details: String, timestamp: { type: Number, default: null }, _id: false }],
      default: [],
    },
    decisions: { type: [decisionSchema], default: [] },
    suggestions: { type: [String], default: [] }, // proposals that were NOT finalized
    actionItems: { type: [actionItemSchema], default: [] },
    pendingQuestions: { type: [String], default: [] },
    technicalDetails: {
      bugs: { type: [String], default: [] },
      proposedSolutions: { type: [String], default: [] },
      architectureChanges: { type: [String], default: [] },
      dependencies: { type: [String], default: [] },
      implementationDecisions: { type: [String], default: [] },
    },
    nextSteps: { type: [String], default: [] },
    uncertainties: { type: [String], default: [] },

    model: { type: String, default: "" },
    editedByUser: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type MeetingNotes = InferSchemaType<typeof notesSchema>;
export const MeetingNotesModel = model("MeetingNotes", notesSchema);
