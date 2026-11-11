/**
 * Seeds a demo account with sample meetings so the dashboard can be explored
 * before recording anything. Safe to re-run: it replaces the demo user's data.
 *
 *   Email: demo@meetmind.local   Password: demo12345
 */
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { connectDb, disconnectDb } from "../db/connect.js";
import { MeetingModel } from "../models/Meeting.js";
import { MeetingNotesModel } from "../models/MeetingNotes.js";
import { TranscriptModel } from "../models/Transcript.js";
import { UserModel } from "../models/User.js";

const EMAIL = "demo@meetmind.local";

const seg = (startTime: number, speaker: string, text: string, len = 25) => ({
  startTime,
  endTime: startTime + len,
  speaker,
  text,
});

async function main() {
  await connectDb(env.MONGODB_URI);
  const existing = await UserModel.findOne({ email: EMAIL });
  if (existing) {
    const ids = (await MeetingModel.find({ userId: existing._id }).select("_id")).map((m) => m._id);
    await Promise.all([
      MeetingModel.deleteMany({ userId: existing._id }),
      TranscriptModel.deleteMany({ meetingId: { $in: ids } }),
      MeetingNotesModel.deleteMany({ meetingId: { $in: ids } }),
    ]);
    await existing.deleteOne();
  }

  const user = await UserModel.create({
    name: "Demo User",
    email: EMAIL,
    passwordHash: await bcrypt.hash("demo12345", 12),
  });
  const userId = user._id;

  // 1 — mirrors the product reference design
  const evaluation = await MeetingModel.create({
    userId,
    title: "Unitask.io | Monthly Evaluation - Q2 2026",
    meetingUrl: "https://meet.google.com/uyo-tynx-plgx",
    tags: ["Monthly Evaluation", "1on1 Meeting", "Quarterly Meeting"],
    participants: ["Cameron Williamson", "Kristin Watson", "Brooklyn Simmons"],
    status: "completed",
    processingStage: "done",
    startedAt: new Date("2026-05-12T13:40:00"),
    endedAt: new Date("2026-05-12T15:40:00"),
    duration: 7200,
    consentConfirmed: true,
    captureMicrophone: true,
    expectedChunks: 24,
  });
  await TranscriptModel.create({
    meetingId: evaluation._id,
    userId,
    segments: [
      seg(12, "Cameron Williamson", "Thanks everyone for joining. Today is the Q2 design evaluation for the SaaS landing page."),
      seg(41, "Kristin Watson", "I'll start with the UI kit. We migrated most components to Shadcn, but a few still have inconsistent spacing."),
      seg(78, "Brooklyn Simmons", "Are those inconsistencies blocking development, or can engineering start in parallel?"),
      seg(102, "Kristin Watson", "Engineering can start. I'll audit and clean up the Shadcn UI kit components by the 28th of May."),
      seg(1840, "Cameron Williamson", "Let's review the user flow. Onboarding still has one step too many before the dashboard."),
      seg(1895, "Brooklyn Simmons", "We agreed last month to merge the workspace and profile steps. Let's lock that in."),
      seg(1932, "Cameron Williamson", "Agreed, decision made: onboarding becomes a single combined step."),
      seg(3604, "Kristin Watson", "For the hero section I'd like to build a high-fidelity prototype in Framer to test the interaction."),
      seg(3650, "Cameron Williamson", "Good. Kristin, can you have the Framer prototype ready by May 30th?"),
      seg(3671, "Kristin Watson", "Yes, May 30th works."),
      seg(5562, "Cameron Williamson", "Okay, looking at the SaaS landing page design we reviewed, the interactions in the hero section are pretty smooth. We might just need to tidy up the component system a bit so the handoff is seamless.", 90),
      seg(5652, "Brooklyn Simmons", "Agreed. Beyond the design side, let's also make sure our payment gateway setup with Wise and PayPal is all sorted out, so we're ready before the Q3 campaign goes live.", 88),
      seg(5745, "Brooklyn Simmons", "I'll handle the Wise and PayPal setup for Gumroad payments."),
      seg(5790, "Kristin Watson", "Should we also start a new style guide exploration for next month? Maybe in Figma?"),
      seg(5820, "Cameron Williamson", "Let's start the visual direction exploration in Figma, end of May is fine. We still need to decide whether dark mode ships at launch."),
      seg(5870, "Brooklyn Simmons", "I'll set up a meeting with stakeholders to discuss the Q3 goals."),
      seg(7100, "Cameron Williamson", "Great session. I'll send a recap. Thanks all."),
    ],
  });
  await MeetingNotesModel.create({
    meetingId: evaluation._id,
    userId,
    model: "llama3.1:8b",
    objective: "Evaluate Q2 design progress for the SaaS landing page and define next month's design exploration.",
    overview: "Evaluate Q2 design progress for the SaaS landing page and define next month's design exploration.",
    executiveSummary:
      "This meeting covered the design progress evaluation for the SaaS landing page throughout Q2. The team reviewed the integration of the new Shadcn UI kit, confirmed engineering can start in parallel while remaining spacing issues are cleaned up, and simplified onboarding into a single step. Next steps include a Framer prototype for the hero interaction, payment gateway setup ahead of the Q3 campaign, and a new visual direction exploration in Figma.",
    discussionPoints: [
      { topic: "Shadcn UI kit integration", details: "Most components migrated; some spacing inconsistencies remain but do not block development.", timestamp: 41 },
      { topic: "Onboarding user flow", details: "One step too many before reaching the dashboard.", timestamp: 1840 },
      { topic: "Hero section interaction", details: "Interactions are smooth; component system needs tidying for handoff.", timestamp: 3604 },
      { topic: "Payments readiness", details: "Wise and PayPal must be configured before the Q3 campaign.", timestamp: 5652 },
    ],
    decisions: [
      { description: "Engineering starts development in parallel with the UI kit clean-up.", timestamp: 102 },
      { description: "Onboarding merges workspace and profile into a single combined step.", timestamp: 1932 },
    ],
    suggestions: ["Start a new style guide exploration for next month."],
    actionItems: [
      { task: "Audit and clean up the Shadcn UI kit components", assignedTo: "Kristin Watson", deadline: new Date("2026-05-28"), deadlineText: "by the 28th of May", timestamp: 102 },
      { task: "Build a high-fidelity prototype in Framer for the hero section interaction", assignedTo: "Kristin Watson", deadline: new Date("2026-05-30"), deadlineText: "by May 30th", timestamp: 3650, status: "done" },
      { task: "Set up Wise and PayPal for Gumroad payment", assignedTo: "Brooklyn Simmons", deadlineText: "before the Q3 campaign", timestamp: 5745, uncertain: true },
      { task: "Start visual direction and new style guide exploration in Figma", deadlineText: "end of May", timestamp: 5820, uncertain: true },
      { task: "Meeting with stakeholders to discuss Q3 goals", assignedTo: "Brooklyn Simmons", timestamp: 5870, status: "done" },
      { task: "Create new account for design exploration", source: "user", status: "done" },
    ],
    pendingQuestions: ["Should dark mode ship at launch?"],
    nextSteps: ["Send meeting recap to all participants", "Review the Framer prototype at the next sync"],
    uncertainties: ["Owner for the Figma style guide exploration was not stated."],
  });

  // 2 — technical meeting
  const sprint = await MeetingModel.create({
    userId,
    title: "Sprint Planning – Payments API v2",
    meetingUrl: "https://meet.google.com/kbr-qxwe-trn",
    tags: ["Sprint Planning", "Engineering"],
    participants: ["Jenny Wilson", "Devon Lane"],
    status: "completed",
    processingStage: "done",
    startedAt: new Date("2026-05-20T10:00:00"),
    endedAt: new Date("2026-05-20T10:45:00"),
    duration: 2700,
    consentConfirmed: true,
  });
  await TranscriptModel.create({
    meetingId: sprint._id,
    userId,
    segments: [
      seg(5, "Jenny Wilson", "Main topic is the webhook retry bug. Duplicate charge events are hitting the ledger."),
      seg(48, "Devon Lane", "The root cause is that we don't store idempotency keys for webhook deliveries."),
      seg(95, "Jenny Wilson", "Decision: we add an idempotency key table in Postgres and reject duplicates at the API layer."),
      seg(140, "Devon Lane", "I'll implement the idempotency middleware this sprint."),
      seg(210, "Jenny Wilson", "We also depend on the Stripe SDK upgrade to v14 before we can ship this."),
      seg(260, "Devon Lane", "Open question: do we backfill keys for historical events?"),
    ],
  });
  await MeetingNotesModel.create({
    meetingId: sprint._id,
    userId,
    model: "llama3.1:8b",
    objective: "Plan the sprint for Payments API v2 and resolve the webhook retry bug.",
    executiveSummary:
      "The team traced duplicate charge events to missing idempotency keys for webhook deliveries and decided to add an idempotency key table with API-layer rejection. Shipping depends on upgrading the Stripe SDK to v14.",
    discussionPoints: [{ topic: "Webhook retry bug", details: "Duplicate charge events reach the ledger.", timestamp: 5 }],
    decisions: [{ description: "Add an idempotency key table in Postgres and reject duplicates at the API layer.", timestamp: 95 }],
    actionItems: [{ task: "Implement idempotency middleware", assignedTo: "Devon Lane", deadlineText: "this sprint", timestamp: 140 }],
    pendingQuestions: ["Should idempotency keys be backfilled for historical events?"],
    technicalDetails: {
      bugs: ["Duplicate webhook deliveries create duplicate ledger entries"],
      proposedSolutions: ["Idempotency key table + API-layer duplicate rejection"],
      architectureChanges: ["New idempotency_keys table in Postgres"],
      dependencies: ["Stripe SDK v14 upgrade"],
      implementationDecisions: ["Reject duplicates in middleware before business logic"],
    },
    nextSteps: ["Upgrade Stripe SDK", "Ship idempotency middleware"],
  });

  // 3 — failed processing, shows recovery UI
  await MeetingModel.create({
    userId,
    title: "Design Critique – Mobile Onboarding",
    meetingUrl: "https://meet.google.com/ppl-zmea-wqs",
    tags: ["Design Review"],
    status: "failed",
    processingStage: "failed",
    processingError: "Cannot reach Ollama at http://127.0.0.1:11434. Is it running?",
    startedAt: new Date("2026-05-26T16:00:00"),
    endedAt: new Date("2026-05-26T16:30:00"),
    duration: 1800,
    consentConfirmed: true,
  });

  console.log(`Seeded demo account → ${EMAIL} / demo12345`);
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDb();
  process.exit(1);
});
