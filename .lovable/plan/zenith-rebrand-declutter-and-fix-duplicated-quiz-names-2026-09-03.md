# Zenith — rebrand, declutter, and fix duplicated quiz names

Three things: stop titles repeating the subject, reorganise the wall of tabs into a real dashboard layout, and rebrand the whole front end as Zenith in orange and white.

## 1. Quiz names no longer repeat the subject

Today a row reads "Sociology — Sociology Quiz" because the stored title already contains the subject.

- Clean the stored titles once: strip a leading subject (and any leftover dash) from every deadline title where it duplicates the subject, so "Sociology Quiz" becomes "Quiz", "Midterm — Behavioural Economics" becomes "Midterm", "Ops Research Quiz 2" keeps its number as "Quiz 2".
- Add a small display guard so any future title that repeats its subject is trimmed on screen too, everywhere a deadline title appears (feed rows, calendar, event drawer, today column, activity).
- Nothing is deleted; only the redundant subject text inside titles is removed.

## 2. Layout: one dashboard, one rail, no tab wall

Main navigation drops to four tabs: **Feed · Calendar · Timetable · Attendance**.

```text
┌──────────────────────────────────────────────────────────┐
│ Zenith    batch selector        search   + Add   profile ▾│
├──────────────────────────────────────────────────────────┤
│  Feed | Calendar | Timetable | Attendance                 │
├───────────────────────────────┬──────────────────────────┤
│  Today (day pulse)            │  Announcements           │
│  Ongoing / Upcoming / Done    │  Recent activity         │
│  deadline cards               │  (sticky right rail)     │
└───────────────────────────────┴──────────────────────────┘
```

- **Right rail (Feed only, sticky, desktop):** Announcements and Activity live here permanently instead of being tabs. On mobile they stack below the feed.
- **Header profile menu:** Members, Feedback, and — for moderators — Approvals (with pending count) and Inbox move into a dropdown next to the avatar, opening as focused overlays/panels rather than board tabs.
- Buttons get one consistent system: a single primary style (solid orange), one secondary (outline), one quiet/icon style, consistent 10px radius and heights, so Add / Edit / Export / filters stop looking like five different kits.
- Filter chips and search collapse into one toolbar shared by Feed and Calendar instead of each tab inventing its own row.

## 3. Zenith rebrand — orange and white

- Rename throughout: header lockup, landing page, page titles and meta, footer become **Zenith** (with "TAPMI Manipal · MAHE" as the supporting line).
- New palette: white / warm off-white surfaces, near-black ink text, one confident orange accent (sunrise orange) with a deeper amber for hover and pressed states; urgency colours re-tuned to read on light (red / amber / green stay, muted to fit).
- The dark aurora blobs go; replaced with quiet warm gradient washes and hairline borders so the board looks composed rather than glowing.
- Landing page rebuilt for Zenith: bold split hero ("Zenith — every deadline, class and attendance mark at its peak"), clean feature grid, the MAHE institutions section and the three-step onboarding kept but re-laid out on the new light system, single orange CTA.
- Typography stays Montserrat / Source Sans 3 / IBM Plex Mono; weights and sizes tightened for the light background.

## Technical notes

- One data migration to normalise `deadlines.title`; a `displayTitle(subject, title)` helper in `src/lib/deadlines.ts` used by `DeadlineRow`, `EventDrawer`, `CalendarPanel`, `DayPulsePanel`, `ActivityPanel`.
- Colour work is entirely in `src/styles.css` tokens (`--ground`, `--surface`, `--ink`, `--accent`, event colours); components keep using semantic tokens, no hardcoded colours.
- `src/routes/index.tsx` restructures to a two-column grid on Feed; `announcements/activity/members/feedback/approvals/inbox` leave `TabKey`. `MembersPanel`, `FeedbackPanel`, `ApprovalsPanel`, `EmailInboxPanel` render inside a dialog/sheet launched from `BoardHeader`.
- Route `head()` metadata updated for the Zenith name on `/`, `/auth`, `/profile`, `/admin`.
- No backend, RLS, or query logic changes beyond the title cleanup.
