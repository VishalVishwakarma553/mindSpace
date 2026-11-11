# Product Requirements Document (PRD)
# MeetMind – AI-Powered Meeting Assistant

**Version:** 1.0  
**Status:** Initial Product Specification  
**Product Type:** Desktop-first Web Application + Chrome Extension  
**Primary Platform:** Google Meet  
**Target Users:** Individuals, developers, students, teams and professionals  
**Primary Goal:** Generate accurate, structured AI meeting notes without requiring expensive subscriptions.

---

## 1. Product Overview

### 1.1 Problem Statement

People frequently attend online meetings, particularly through Google Meet. During these meetings, participants need to focus on discussions while simultaneously remembering important information, decisions, deadlines and assigned tasks.

Manually taking notes creates several problems:

- Important discussion points can be missed.
- Remembering decisions after long meetings is difficult.
- Action items and responsibilities can be forgotten.
- Reviewing a three-hour meeting takes considerable time.
- Existing AI meeting assistants often require paid subscriptions.

### 1.2 Proposed Solution

MeetMind is an AI-powered meeting assistant that records meeting audio, converts conversations into text and automatically generates structured meeting notes.

It will initially focus on Google Meet through a Chrome extension.

The application will prioritize local-first processing and open-source AI models to minimize recurring infrastructure and subscription costs.

### 1.3 Product Vision

Build a personal AI meeting assistant that allows users to concentrate entirely on conversations while AI takes care of documentation, summaries, decisions and follow-ups.

---

## 2. Product Goals

### Primary Goals

1. Record Google Meet meetings lasting up to three hours.
2. Generate transcripts from recorded audio.
3. Generate meaningful AI-powered meeting summaries.
4. Extract decisions, action items and deadlines.
5. Maintain searchable meeting history.
6. Minimize operational costs using open-source technologies.
7. Support laptops with 16 GB RAM and Intel Core i5 processors.

### Secondary Goals

- Support multiple meeting platforms in the future.
- Provide live transcription.
- Identify speakers.
- Generate follow-up emails.
- Allow exporting meeting notes.
- Provide conversational search across previous meetings.

### Success Metrics

| Metric | Initial target |
|---|---|
| Maximum meeting duration | 3 hours |
| Recording reliability | At least 99% under supported conditions |
| Audio storage | Compressed audio |
| Transcription | Automatic after recording |
| Summary generation | Automatic after transcription |
| Meeting history | Persistent |
| Processing cost | Zero recurring AI API cost in local-only mode |
| User experience | Minimal manual intervention |

Note: Transcription accuracy and processing time will be measured during real-world testing rather than treated as guaranteed figures.

---

## 3. Target Users

### Persona 1: Working Professionals

People attending daily team meetings, sprint planning, stand-ups and client discussions.

**Needs:**
- Meeting summaries.
- Task assignments.
- Important decisions.
- Deadlines and follow-ups.

### Persona 2: Developers and Technical Teams

People discussing development tasks, bugs, architecture and project requirements.

**Needs:**
- Technical discussion summaries.
- Identified bugs and proposed solutions.
- Assigned development tasks.
- Technical decisions and unresolved questions.

### Persona 3: Students

Students attending online classes, lectures and group discussions.

**Needs:**
- Lecture summaries.
- Important concepts.
- Key points.
- Revision notes.

---

## 4. Product Scope

### 4.1 MVP Features

The first release will contain the following functionality.

| Feature | Priority |
|---|---|
| Chrome extension | P0 |
| Google Meet audio capture | P0 |
| Start/stop recording | P0 |
| Three-hour recording support | P0 |
| Audio chunking | P0 |
| Local audio storage | P0 |
| Speech-to-text conversion | P0 |
| AI meeting summary | P0 |
| Action item extraction | P0 |
| Meeting history dashboard | P0 |
| Meeting details page | P0 |
| Transcript viewer | P0 |
| Export notes | P1 |
| Speaker identification | P1 |
| Live transcription | P2 |
| Cross-meeting AI search | P2 |
| Calendar integration | P2 |

P0 = Required for initial release.  
P1 = Next development phase.  
P2 = Future enhancement.

---

# 5. Functional Requirements

## 5.1 User Onboarding

The user should be able to:

- Open the MeetMind web application.
- Configure local processing preferences.
- Install the Chrome extension.
- Connect the extension with the application.
- Select a preferred transcription and summarization model.
- Configure audio storage preferences.

The application should provide a setup guide explaining how to install and configure the required local processing dependencies.

## 5.2 Chrome Extension

The extension is the primary interface for meeting recording.

### Requirements

1. Detect whether the current browser tab is a supported Google Meet session.
2. Display recording controls.
3. Allow the user to start recording manually.
4. Request appropriate browser permissions.
5. Capture Google Meet tab audio.
6. Optionally capture the user's microphone.
7. Display recording status.
8. Display recording duration.
9. Allow users to pause and resume recording.
10. Allow users to stop recording.
11. Handle accidental tab closure and recording interruptions gracefully.

### Extension UI

The extension popup should display:

- Meeting title, where available.
- Recording status.
- Recording duration.
- Start recording button.
- Pause button.
- Resume button.
- Stop recording button.
- Audio capture status.
- Link to open MeetMind dashboard.

### Recording States

| State | Description |
|---|---|
| Idle | No active recording |
| Recording | Audio is being captured |
| Paused | Recording temporarily stopped |
| Processing | Audio is being processed |
| Completed | Notes successfully generated |
| Failed | An error occurred |

Recording must only start after explicit user action. Participants should be informed and their consent obtained.

## 5.3 Audio Recording Engine

### Requirements

The recording engine must:

- Capture audio from the Google Meet browser tab.
- Optionally capture microphone input.
- Support compressed WebM/Opus audio.
- Record meetings up to three hours.
- Save recordings in manageable chunks.
- Avoid keeping the entire recording in browser memory.
- Handle temporary network interruptions.
- Recover from interrupted recording sessions where possible.

### Audio Chunking Strategy

Instead of maintaining one large audio blob, the application should save audio in smaller segments.

**Recommended initial configuration:**

- Chunk duration: 5 minutes.
- Audio format: WebM/Opus.
- Audio storage: Local disk.
- Processing: Sequential chunk processing.

For a three-hour meeting, this produces approximately 36 audio chunks.

This architecture reduces memory pressure and makes recovery easier.

## 5.4 Speech-to-Text Engine

The transcription engine converts recorded audio into text.

### Primary Technology

- Whisper / faster-whisper.
- CPU INT8 inference for systems without dedicated GPUs.

### Requirements

1. Accept recorded audio chunks.
2. Convert audio into the required format.
3. Generate text transcripts.
4. Maintain timestamps.
5. Support English initially.
6. Preserve transcript ordering.
7. Handle different audio qualities.
8. Retry failed chunks.
9. Combine transcripts into one complete transcript.

### Future Enhancements

- Hindi transcription.
- Hinglish transcription.
- Multilingual support.
- Speaker diarization.
- Better handling of technical terminology.

Speaker diarization should be treated as a separate capability from transcription. It must not assume that a speaker's identity can always be determined from mixed meeting audio.

## 5.5 AI Meeting Notes Generator

This is the primary intelligence layer of MeetMind.

After transcription, the application should send transcript segments to an LLM for structured analysis.

### Generated Output

**A. Meeting Overview**

- Meeting title.
- Date and time.
- Duration.
- Participants, where reliably available.
- Meeting objective.

**B. Executive Summary**

A concise explanation of the overall meeting.

**C. Key Discussion Points**

Important subjects discussed during the meeting, grouped by topic.

**D. Decisions Made**

Clearly identify finalized decisions.

**E. Action Items**

For every action item, extract:

- Task description.
- Responsible person, if explicitly identifiable.
- Deadline, if mentioned.
- Status.

**F. Pending Questions**

Questions that were raised but not resolved.

**G. Important Technical Details**

For technical meetings, extract:

- Bugs discussed.
- Proposed solutions.
- API or architecture changes.
- Technical dependencies.
- Implementation decisions.

**H. Next Steps**

A concise list of activities to be completed after the meeting.

### AI Accuracy Requirements

- Do not invent decisions or tasks.
- Do not assign tasks to people without evidence.
- Do not invent deadlines.
- Distinguish suggestions from finalized decisions.
- Preserve important technical terminology.
- Clearly identify information that is uncertain.
- Maintain references to transcript timestamps wherever possible.

## 5.6 Meeting Dashboard

The dashboard is the central place for managing meetings.

### Dashboard Sections

**Overview**
- Total meetings.
- Total recorded duration.
- Recently processed meetings.
- Pending processing jobs.

**Meeting History**

Each meeting card should display:

- Meeting title.
- Meeting date.
- Duration.
- Processing status.
- Short summary.
- Number of action items.

**Search and Filters**

Users should be able to:

- Search by meeting title.
- Search transcript content.
- Filter by date.
- Filter by processing status.
- Sort meetings by date.

## 5.7 Meeting Details Page

Each meeting should have a dedicated details page.

### Suggested Layout

**Header**
- Meeting title.
- Date.
- Duration.
- Processing status.
- Export button.

**Navigation Tabs**

1. Overview
2. Summary
3. Transcript
4. Action Items
5. Decisions

Users should be able to edit meeting titles and manually correct generated notes.

### Action Items Management

Users should be able to:

- Mark tasks as completed.
- Edit task descriptions.
- Assign task owners.
- Add deadlines.
- Delete incorrect tasks.

## 5.8 Export Functionality

The application should allow users to export:

- Meeting summaries.
- Full transcripts.
- Action items.
- Complete meeting notes.

Initial supported formats:

- PDF
- TXT
- Markdown

---

# 6. Technical Architecture

## 6.1 Recommended Technology Stack

| Layer | Technology |
|---|---|
| Web frontend | Next.js + TypeScript |
| UI | Tailwind CSS |
| Browser extension | Chrome Extension Manifest V3 |
| Backend | Node.js + Express |
| Communication | REST APIs + WebSockets |
| Audio capture | Chrome tabCapture + MediaRecorder |
| Audio processing | Python |
| Speech recognition | faster-whisper |
| AI summarization | Ollama + local LLM |
| Database | MongoDB |
| Audio storage | Local filesystem |
| Authentication | JWT |
| Background processing | Python worker initially |

### Architectural Decision

Use Python for transcription and Node.js for application APIs.

Whisper has a mature Python ecosystem, so using Python for transcription avoids unnecessary integration complexity.

## 6.2 High-Level Architecture

```text
                 GOOGLE MEET
                      |
                      v
             CHROME EXTENSION
                      |
             Capture Tab Audio
                      |
                MediaRecorder
                      |
              Audio Chunking
                      |
                      v
              LOCAL AUDIO STORAGE
                      |
                      v
              NODE.JS BACKEND
                      |
                Processing Queue
                      |
                      v
             PYTHON WORKER
                      |
                 FASTER-WHISPER
                      |
                      v
                TRANSCRIPT
                      |
                      v
               LOCAL LLM
                  OLLAMA
                      |
                      v
             STRUCTURED AI NOTES
                      |
                      v
                 MONGODB
                      |
                      v
              NEXT.JS DASHBOARD
```

## 6.3 Processing Workflow

1. User starts recording from the extension.
2. Chrome captures the meeting audio.
3. Audio is recorded in five-minute chunks.
4. Each completed chunk is persisted locally.
5. User stops recording.
6. Recording metadata is saved.
7. The transcription job is created.
8. Python worker processes audio chunks sequentially.
9. Transcripts are merged with timestamps.
10. The transcript is split into manageable sections.
11. The LLM generates section summaries.
12. A final summarization step combines the section summaries.
13. Structured meeting notes are saved.
14. The dashboard displays the completed meeting.

The system must support retries without processing already completed chunks unnecessarily.

---

# 7. Database Design

Initial MongoDB collections:

## 7.1 Users

```javascript
{
  _id: ObjectId,
  name: String,
  email: String,
  passwordHash: String,
  preferences: {
    transcriptionModel: String,
    summarizationModel: String,
    storageMode: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

## 7.2 Meetings

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  title: String,
  platform: "google_meet",
  meetingUrl: String,

  status: "recording",

  startedAt: Date,
  endedAt: Date,
  duration: Number,

  audioPath: String,

  processingStatus: "pending",

  createdAt: Date,
  updatedAt: Date
}
```

## 7.3 AudioChunks

```javascript
{
  _id: ObjectId,
  meetingId: ObjectId,

  chunkIndex: Number,
  filePath: String,

  startTime: Number,
  endTime: Number,

  duration: Number,
  fileSize: Number,

  status: "pending",

  createdAt: Date
}
```

## 7.4 Transcripts

```javascript
{
  _id: ObjectId,
  meetingId: ObjectId,

  segments: [
    {
      startTime: Number,
      endTime: Number,
      speaker: String,
      text: String
    }
  ],

  language: String,
  status: String,

  createdAt: Date
}
```

## 7.5 MeetingNotes

```javascript
{
  _id: ObjectId,
  meetingId: ObjectId,

  overview: String,
  executiveSummary: String,

  discussionPoints: [
    {
      topic: String,
      details: String
    }
  ],

  decisions: [
    {
      description: String,
      timestamp: Number
    }
  ],

  actionItems: [
    {
      task: String,
      assignedTo: String,
      deadline: Date,
      status: String
    }
  ],

  pendingQuestions: [String],
  nextSteps: [String],

  createdAt: Date,
  updatedAt: Date
}
```

The database should store metadata and structured content. Large audio files should remain in filesystem or object storage rather than being embedded in MongoDB documents.

---

# 8. Non-Functional Requirements

## 8.1 Performance

- Recording should not significantly interfere with Google Meet.
- The extension must avoid retaining hours of audio in memory.
- Audio chunks must be persisted reliably.
- Transcription should run sequentially or with controlled concurrency.
- Dashboard operations should remain responsive during processing.

## 8.2 Hardware Compatibility

Initial development target:

| Component | Minimum target |
|---|---|
| RAM | 16 GB |
| Processor | Intel Core i5 |
| Storage | 256 GB SSD |
| GPU | Not required |
| OS | Windows 10/11 |
| Browser | Latest Chrome |

The application must be tested on CPU-only hardware.

Transcription speed will depend on processor generation, audio length, selected model and background workload.

## 8.3 Reliability

- Recover from failed transcription jobs.
- Preserve completed audio chunks.
- Maintain processing status.
- Avoid duplicate transcripts.
- Support interrupted processing and retries.
- Notify users when processing fails.

## 8.4 Privacy and Security

- Recording must require explicit user initiation.
- Participants must be informed and appropriate consent obtained.
- Store recordings securely.
- Do not expose local audio files through public endpoints.
- Validate ownership of meeting resources.
- Restrict file access to authorized users.
- Provide deletion controls.
- Do not send audio or transcripts to external AI providers in local-only mode.

---

# 9. UI/UX Requirements

The application should follow a modern, minimal SaaS dashboard design.

### Design Principles

- Clean and uncluttered interface.
- Clear separation between meeting summaries and transcripts.
- Minimal navigation.
- Readable typography.
- Clear processing indicators.
- Responsive design.
- Accessible controls.

### Main Screens

1. Onboarding and setup.
2. Dashboard.
3. Meeting history.
4. Meeting details.
5. Transcript viewer.
6. Application settings.

### Important UX Detail

A user should not need to understand AI models, transcription configurations or technical processing steps to record a meeting.

The default user journey should be:

**Open Meet → Start Recording → Attend Meeting → Stop Recording → View AI Notes.**

---

# 10. Development Roadmap

## Phase 1: Foundation

**Goal:** Establish the project infrastructure.

- Initialize Next.js application.
- Initialize Express backend.
- Set up MongoDB.
- Create Chrome extension.
- Configure extension-to-backend communication.
- Implement basic dashboard.

**Deliverable:** Working application skeleton.

## Phase 2: Audio Recording

**Goal:** Build reliable Google Meet audio capture.

- Implement tabCapture.
- Implement MediaRecorder.
- Implement audio chunking.
- Add recording controls.
- Save chunks locally.
- Handle recording interruptions.
- Test long-duration recording.

**Deliverable:** A Chrome extension capable of recording a three-hour meeting.

## Phase 3: Speech Recognition

**Goal:** Convert audio into text.

- Set up Python environment.
- Install faster-whisper.
- Configure CPU INT8.
- Implement transcription worker.
- Process audio chunks.
- Merge transcripts.
- Save timestamps.

**Deliverable:** Complete meeting transcript.

## Phase 4: AI Summarization

**Goal:** Generate intelligent meeting notes.

- Install and configure Ollama.
- Select a suitable local model.
- Design summarization prompts.
- Implement chunk-based summarization.
- Extract decisions.
- Extract action items.
- Generate final structured notes.

**Deliverable:** AI-generated meeting notes.

## Phase 5: Dashboard and History

**Goal:** Make meeting notes usable.

- Implement meeting history.
- Build meeting details page.
- Implement transcript viewer.
- Display summaries.
- Display action items.
- Implement search and filters.
- Implement export functionality.

**Deliverable:** Complete MVP.

## Phase 6: Testing and Optimization

**Goal:** Ensure stability on target hardware.

Test scenarios:

- 15-minute meeting.
- 30-minute meeting.
- 1-hour meeting.
- 2-hour meeting.
- 3-hour meeting.
- Interrupted recording.
- Missing audio chunk.
- Failed transcription.
- Insufficient disk space.
- Low-quality audio.
- Multiple speakers.

**Deliverable:** Stable first release.

---

# 11. MVP Acceptance Criteria

The first release will be considered successful when:

1. The user can install the Chrome extension.
2. The user can start and stop recording manually.
3. Google Meet tab audio is captured successfully.
4. The application supports a three-hour recording test.
5. Audio is persisted in chunks.
6. Audio can be transcribed using the local Whisper engine.
7. A complete transcript is generated.
8. AI generates an executive summary.
9. Decisions and action items are extracted.
10. Meeting information is saved in MongoDB.
11. The user can revisit previous meetings.
12. The user can export the generated notes.
13. The application can recover from processing failures without losing completed work.

---

# 12. Risks and Mitigation

| Risk | Mitigation |
|---|---|
| CPU transcription is slow | Use faster-whisper CPU INT8 and smaller models |
| High memory usage | Process audio chunks sequentially |
| Long meeting audio files | Compress and persist chunks |
| Browser tab closes | Persist completed chunks and implement recovery |
| Poor audio quality | Provide audio quality checks |
| AI hallucinations | Ground summaries in transcript segments |
| Incorrect task assignments | Require explicit evidence |
| Disk space exhaustion | Monitor storage and notify users |
| LLM context limitations | Summarize transcript in chunks |
| Privacy concerns | Local-first processing and explicit recording controls |

---

# 13. Future Enhancements

After the MVP becomes stable, the following features can be introduced:

### Intelligent Meeting Assistant

- Ask questions about previous meetings.
- Search across all meeting transcripts.
- Find when a particular topic was discussed.
- Identify recurring unresolved issues.
- Compare decisions across meetings.

### Productivity Features

- Automatically prepare follow-up emails.
- Generate Jira or GitHub issues from action items.
- Create daily meeting reports.
- Generate weekly meeting summaries.
- Integrate with Google Calendar.

### Platform Expansion

- Microsoft Teams.
- Zoom.
- Other browser-based meeting platforms.

---

# 14. Final Product Recommendation

The initial product should be built as a **local-first AI meeting assistant**, not as a cloud-dependent SaaS application.

The first priority is not to build every advanced AI feature. It is to ensure that a user can reliably record a three-hour meeting, generate a transcript and receive useful notes on an ordinary laptop.

### Recommended MVP Technology Stack

- Next.js + TypeScript
- Chrome Extension Manifest V3
- Node.js + Express
- Python + faster-whisper
- Ollama + local LLM
- MongoDB
- Local audio filesystem

### Core Product Principle

**Capture reliably. Transcribe accurately. Summarize intelligently. Store securely.**

That is the foundation on which every advanced MeetMind feature should be built.