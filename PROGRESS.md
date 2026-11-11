# MeetMind: Build Progress

Snapshot as of 2026-11-09. Requirements come from [prd.md](prd.md). The UI is meant to match the dark reference screenshot.

**Overall status:** the backend is done and tested. The web app is about 60% done and has **never been compiled or run**. The Chrome extension and the Python worker have **not been started**.

---

## ✅ Done

### Tooling and setup
- [x] Installed the **ui-ux-pro-max** skill into the project ([.claude/skills/ui-ux-pro-max/](.claude/skills/ui-ux-pro-max/)) and ran its design-system generator.
- [x] Wrote [design-system/meetmind/MASTER.md](design-system/meetmind/MASTER.md):
  - Rejected the generator's light teal palette.
  - Replaced it with tokens taken from the screenshot: near-black surfaces, white CTA, blue `#5B7CFA` accent, amber and orange chips.
  - Font is **Google Sans**.
  - Includes the skill's accessibility rules.
- [x] Set up an npm workspaces monorepo: root [package.json](package.json), `apps/server`, `apps/web`.
- [x] Added a local MongoDB workaround. The installed `mongod.exe` 8.3 **does not run on this Windows 10 machine** (it exits with error `0xC0000139`).
  - `npm run db:dev --workspace apps/server` starts a downloaded MongoDB 7.0.14.
  - Its data persists in `.data/db`.

### Backend (`apps/server`): Express 5, TypeScript, Mongoose 9, Zod 4
- [x] Config is validated with zod ([src/config/env.ts](apps/server/src/config/env.ts)), and the server refuses to start in production with the dev JWT secret. A `.env` with random secrets has been generated.
- [x] Models match PRD §7, with extra fields for the enhancements: User, Meeting, AudioChunk (with per-chunk transcript), Transcript, MeetingNotes, Job.
- [x] **Auth** uses JWT in an httpOnly cookie for the web app, or a bearer token for the extension. Login is rate-limited, error messages don't reveal which emails exist, and there is an account deletion endpoint.
- [x] **Recording API** (PRD §5.2–5.3): create meeting (requires participant consent), idempotent 5-minute chunk upload, heartbeat, finish (detects missing chunks), reprocess and recovery. Uploads are refused when free disk space runs low.
- [x] **Processing pipeline** (PRD §6.3):
  - Job queue with leases, retries and exponential backoff.
  - Already-transcribed chunks are never redone.
  - A sweeper marks closed-tab recordings as "interrupted" and fails dead jobs.
- [x] **Worker API** for the Python worker: claim, heartbeat, per-chunk transcript, chunk failure, complete, fail. Protected by a shared token compared in constant time.
- [x] **AI notes** (PRD §5.5):
  - Ollama structured JSON output, run as map-reduce over transcript sections.
  - **Grounding rules**: owners not mentioned in the transcript are removed, deadlines without a spoken phrase are dropped, and timestamps outside the recording are rejected.
  - If the merge step fails, a deterministic fallback merges the section results.
- [x] **Meetings API**: list with search, transcript search, status and date filters, sorting and pagination. Also detail, edit, delete (removes files too), and audio streaming that checks ownership.
- [x] **Manual corrections** (PRD §5.7): edit notes, add/edit/complete/delete action items, edit transcript segments, rename speakers.
- [x] **Export** (PRD §5.8) in PDF, Markdown and TXT, for the whole meeting, summary, transcript or action items.
- [x] **Enhancements:**
  - Cross-meeting search with timestamped moments.
  - A tasks view across all meetings.
  - Follow-up email draft.
  - System status endpoint for the setup guide.
  - Live updates over WebSocket.
- [x] Seed script `npm run seed` loads demo data that mirrors the screenshot. Login: `demo@meetmind.local` / `demo12345`.
- [x] **Tests: 21/21 passing** (`npm test`). They cover the full record → transcribe → summarize pipeline with a fake LLM, grounding rules, exports, and checks that one user cannot see another's meetings.
- [x] `tsc --noEmit` reports no errors.

### Web app (`apps/web`): Next.js 16.4 (Cache Components), Tailwind 4 (written, but never compiled)
- [x] Config: API proxy rewrite, security headers, Google Sans font, design tokens in `globals.css`, reduced-motion support, visible focus rings.
- [x] Library code: typed API client, types, formatters, react-query hooks with optimistic task updates, WebSocket provider with reconnect and toasts.
- [x] UI kit: Button/IconButton (accessible labels and tooltips), Field/Input/Select/Switch, Dialog, Menu, Chip, Avatar, Skeleton, ProgressBar, EmptyState.
- [x] App shell: icon rail, top bar (breadcrumbs, `/` search shortcut, notifications bell, white "Record a Meeting" button), mobile bottom nav, skip link, auth gate and `proxy.ts` redirect.
- [x] Pages:
  - Login and Register (inline validation, `?next=` restricted to in-app paths).
  - **Dashboard** (stats, a "needs attention" list with retry, recent meetings).
  - **Meetings history** (search, filters, sort, pagination).
- [x] Meeting detail components:
  - Multi-chunk audio player, which pauses when the page is hidden.
  - Media panel with speaker tiles, controls, and a transcript that follows playback.
  - Header with inline rename, tags, share/export/more menus and delete confirmation.
  - Takeaway file cards, tasks grouped by deadline with edit dialog, follow-up email dialog, timestamp chips.

---

## ⏳ Remaining

### Web app: unfinished code
- [ ] `components/meeting/summary-tab.tsx`: objective, discussion points, suggestions, open questions, technical details, next steps, uncertain items, and an "Edit notes" dialog.
- [ ] `components/meeting/decisions-tab.tsx`: decisions list with editing.
- [ ] `components/meeting/transcript-tab.tsx`: search within the transcript, edit segments, rename speakers, copy.
- [ ] `components/meeting/processing-banner.tsx`: shows recording, queued, transcribing or summarizing progress, plus failed and interrupted states with retry.
- [ ] `app/(app)/meetings/[id]/page.tsx`: two-panel layout with tabs (Overview / Summary / Transcript / Action Items / Decisions), focus mode, and `?t=` deep links.
- [ ] `app/(app)/tasks/page.tsx`: all action items, filtered by open, done or all.
- [ ] `app/(app)/search/page.tsx`: cross-meeting search results with jump-to-moment links.
- [ ] `app/(app)/settings/page.tsx`: profile, model preferences, system status, delete account.
- [ ] `app/(app)/setup/page.tsx`: onboarding guide with live dependency checks (PRD §5.1).

### Web app: verification (nothing has been run yet)
- [ ] Run `npm run typecheck`, `npm run lint` and `npm run build`, then fix the errors. Known risks:
  - `player.tsx` writes to refs during render, which the React lint rules may reject.
  - `usePathname` may need a `<Suspense>` boundary under Cache Components.
- [ ] Run the app against the seeded API and check every screen at 375, 768, 1024 and 1440 px wide, then do the ui-ux-pro-max pre-delivery checklist.

### Chrome extension (`apps/extension`): not started (PRD §5.2, P0)
- [ ] Manifest V3, service worker, and an offscreen document that runs `tabCapture` and `MediaRecorder`.
- [ ] Recorder restarts every 5 minutes so each WebM/Opus chunk can be played on its own.
- [ ] Optional microphone mixing, plus a permissions page to request the mic.
- [ ] Popup: login, Google Meet detection, consent checkbox, start/pause/resume/stop, timer, upload status, link to the dashboard.
- [ ] Upload queue stored in IndexedDB with retries, heartbeats, and recovery after the tab is closed.

### Python worker (`apps/worker`): not started (PRD §5.4, P0)
- [ ] `faster-whisper` (CPU, INT8) polling loop using the internal API, with per-chunk retries and lease heartbeats.
- [ ] `requirements.txt`, `.env` with `WORKER_TOKEN`, and run instructions.
- [ ] Check package support: Python here is **3.15**, and `ctranslate2`/`av` may not have wheels for it yet. Python 3.12 may be needed.

### Docs and environment
- [ ] Root `README.md` covering setup, architecture, and how to run everything.
- [ ] Root `.gitignore` (`node_modules`, `.data`, `storage`, `.env`, `.next`).
- [ ] **Ollama** is not installed. It's needed for AI notes: install it, then run `ollama pull llama3.1:8b`.
- [ ] Optional: `git init` and a first commit (only if you ask for it).

---

## How to run what exists now
```bash
npm install                              # from the repo root
npm run db:dev --workspace apps/server   # terminal 1: MongoDB on :27017
npm run seed                             # demo data
npm run dev:server                       # terminal 2: API on :4000
npm test                                 # backend tests (21 passing)
# npm run dev:web                        # web on :3000 (not yet verified to compile)
```
