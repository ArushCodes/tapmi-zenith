# MAHE Portal — Multi-Batch, Timetable, Attendance

Grow the current single-batch TAPMI IPM board into a university portal: an institution hierarchy with many batches, membership approval, a Registro-synced timetable, attendance tracking, and an email-to-event pipeline. Delivered in phases so each one is usable on its own.

## Phase 1 — Hierarchy, batches, membership

Data hierarchy: Institution (MAHE) → School (TAPMI) → Programme (IPM) → Batch (2026–2031) → Section.

- Master selector in the header: pick your batch; everything on the page (board, calendar, timetable, attendance) is scoped to it.
- A user signs up and requests to join a batch. Until a moderator approves, they see a "pending approval" state with read-only public content.
- Roles become per-batch: `student`, `mod`, `admin`. A batch can have unlimited moderators.
- New "Members" tab (mods only): approve/reject join requests, promote a member to moderator, demote, remove.
- Existing deadlines are migrated into the TAPMI IPM 2026–2031 batch so nothing is lost.

## Phase 2 — Timetable tab (Registro sync)

- Each batch stores one shared Registro credential (added by you or a mod through a secure form, never visible in the app) plus its term-session id, and optionally an external .ics URL instead.
- A scheduled backend job runs the equivalent of your Python script: authenticate against Registro, pull term sessions, normalise them with the course→short-name/faculty mapping, and upsert them as `class_sessions` rows for the batch. Re-runs are idempotent (stable hash id per session), bounded per run, and skip a batch whose credentials fail — surfacing the error to its mods.
- The course→short-name/faculty map becomes an editable per-batch table, seeded with your current mapping, so mods can maintain it without a code change.
- Timetable tab: day / week / month views of synced classes, faculty, room, session number, holidays highlighted. Filter by course.
- Each batch exposes a subscribable `.ics` feed URL (classes + approved custom events) so anyone can add it to Google/Apple Calendar. Your existing GitHub Action can keep running; the portal no longer depends on it.
- Custom events: mods add classes/events that Registro does not have. They live alongside synced sessions and are never overwritten by a sync.

## Phase 3 — Attendance

- Roster per batch = approved members.
- Both students and class reps/mods can mark attendance against a class session, with equal control. Each mark records who set it, so a rep's mark and a student's self-mark on the same session are both visible and a mismatch is flagged for review.
- Live tracker: current/next class card with a one-tap Present / Absent action during and shortly after the session window.
- Absentee workbook: per-student, per-course attendance percentage, session-by-session grid, absence reasons, and a warning band when a student approaches the shortage threshold (configurable per batch, default 75%).
- Mods can export the workbook as CSV.

## Phase 4 — Email → event extraction (Outlook)

- You forward or connect an Outlook mailbox; incoming mail hits a webhook endpoint.
- An AI model reads each mail and extracts candidate events (subject, type, due date/time, group vs individual, submission link) with a confidence score and a link back to the source mail.
- Extracted items land in a separate **Email Inbox** review tab as *pending*, never live. A mod approves (optionally editing fields first) or rejects; approved items become normal deadlines/events for the batch.
- Registro-sourced items that need review flow into the same approvals area but as their own section, kept distinct from the existing manual approvals queue.

## Tabs after all phases

Feed · Calendar · Timetable · Attendance · Approvals (mods) · Email Inbox (mods) · Members (mods)

## Technical notes

- New tables: `institutions`, `schools`, `programmes`, `batches`, `sections`, `batch_memberships` (with `status`, `role`), `class_sessions`, `course_map`, `attendance_marks`, `custom_events`, `email_ingest`, plus a `sync_state` row per batch for the single-flight lock and paused state. Every table gets GRANTs, RLS, and batch-scoped policies driven by a `has_batch_role(user, batch, role)` security-definer function.
- `deadlines` gains a `batch_id`; existing rows backfill to the TAPMI IPM batch.
- Registro sync runs as a public server route under `src/routes/api/public/` triggered by a scheduler, with a per-batch lease lock, bounded work per run, idempotent upserts, and a circuit breaker that pauses a batch after repeated failures.
- Registro credentials are stored server-side encrypted and read only inside the sync handler; they are never returned to the client.
- The `.ics` feed is a server route generating the calendar from `class_sessions` + approved custom events, guarded by an unguessable per-batch feed token.
- Email extraction uses the Lovable AI gateway with a structured-output schema; failures are recorded rather than silently dropped.

## Order of work

Phase 1 first (everything else is scoped by batch), then 2, then 3, then 4. Each phase ships independently — tell me if you want a different order or want a phase dropped.
