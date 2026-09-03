# Fix the broken role check, add course weightages, and say what the numbers mean

Three things: repair the database error you hit, build a proper grading/weightage section for IPM-1, and rewrite the attendance wording so it makes sense to someone reading it for the first time.

## 1. The `public.has_role` error (confirmed cause)

A recent security change moved the role-checking helpers out of the public schema into a locked-down one. One leftover piece was missed: the guard that runs on every **profile update** still calls the old `public.has_role(...)`, which no longer exists. So any action that writes to a profile fails with exactly the error you saw.

Fix: point that guard at the new helper. Nothing else in the database still references the old name — checked every function and every security policy.

After the fix I'll re-run the flow that failed for you. If the mail path still errors, the remaining cause is separate and I'll report the actual message rather than guess.

## 2. New "Grading" section

A per-course breakdown of how the final score is built, with your real Term 1 data seeded for IPM-1.

**What you see per course:**
- Course name, code, credits.
- Each grading component: name, weightage %, when it happens (e.g. "after Session 10"), and whether it's individual or group.
- Your marks: enter score out of total for any component; the section shows what that earned out of its weightage.
- A running course score — points banked so far, best case remaining, and a projected final if you keep the same rate.
- Pass warnings from the 40% rule: flagged separately if the overall score is under 40%, or if the End-Term alone is under 40%, since either one is an F.
- Components with no marks yet show as "not graded yet" and don't drag the projection down.

**Seeded for IPM-1 (Term 1):** Basics of Statistics (OPS 1102, 3cr), Introduction to Sociology (MGT 1101, 3cr), Foundations of Psychology (HRM 1101, 3cr), English Language and Literature I (HRM 1102, 3cr), Introduction to AI (ITS 1101, 2cr), Working with Spreadsheets (ANT 4003, 2cr, single 100% online exam), Working in Groups and Team Building (HRM 1103, 1cr) — each with the exact components and percentages you listed.

- Team Building is marked as a Mandatory Learning Course: Satisfactory / Not Satisfactory, excluded from any GPA maths, and labelled as such.
- Basic Mathematics I (OPS 1101, 3cr) is seeded with the placeholder split (20 mid / 40 end / 20 quizzes / 20 CP) and carries a visible "provisional — awaiting official outline" badge.
- Moderators can edit any component, weightage, or add/remove one, for any batch. Weightages that don't total 100% get a quiet warning.
- The existing per-exam marks entry stays and links into this: a deadline can be attached to a component so a mid-term mark flows straight in.

## 3. Plain-English wording everywhere

Replace jargon with what actually happens to you.

| Now | Becomes |
| --- | --- |
| "No penalty" | "You're fine — no marks lost for attendance" |
| "Grade deduction" | "Losing grade points — 0.5 per class missed past the 85% line" |
| "Incomplete (I)" | "You'd fail this course and repeat it next year" |
| "eligibility" | "allowed to sit the exam" |
| "70% / 85%" bare labels | "70% = exam cut-off", "85% = safe line" |

Applied to the attendance donut, the per-subject rows, the policy card, the compact attendance widget in the feed, and anywhere else those phrases appear. The policy card gets a short "what these numbers mean" opener written for someone who has never read the handbook, and the 40% rule is explained there too.

## Technical notes

- Migration 1: `CREATE OR REPLACE FUNCTION public.protect_profile_immutable_fields()` with `private.has_role(...)`; the function keeps `SECURITY DEFINER` and gains `private` in its `search_path`.
- Migration 2: `course_components` (id, batch_id, course_code, course_name, credits, is_mlc, is_provisional, name, weightage numeric, kind enum, sequence, timing_note) plus `component_marks` (id, component_id, batch_id, user_id, score, total, updated_at, unique(component_id,user_id)). GRANTs to `authenticated`/`service_role`, RLS: members read their batch's components, mods write them; marks are private to `user_id` and gated by `private.is_batch_member`. Literal INSERTs seed all eight IPM-1 courses in the same migration.
- `src/lib/grading.ts`: queries plus `earnedPoints`, `bestCase`, `projected`, `failRisk` (overall <40 or end-term <40).
- `src/components/board/GradingPanel.tsx` rendered as a new tab next to Attendance, using existing card/rail primitives.
- Copy lives in one place — `BAND_COPY` / `LEAVE_COPY` in `src/lib/attendance.ts` — so wording stays consistent site-wide.
