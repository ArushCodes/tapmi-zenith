# Master prompt: rebuild this portal from scratch

Copy everything in the block below into a fresh Lovable project as the first message.

```text
Build "TAPMI Zenith" — a dark, modern academic operations portal for a university batch (starting with MAHE → TAPMI → IPM → IPM-1), with Lovable Cloud for auth, database and backend logic.

TECH + STYLE
- TanStack Start (React 19, TanStack Router file routes, Tailwind v4, shadcn/ui, Framer Motion, TanStack Query).
- Dark MAHE design language: deep navy surfaces, orange/gold accents, Montserrat headings, Source Sans 3 body, IBM Plex Mono for numbers. All colors as semantic tokens in src/styles.css — never hardcoded utilities. Lots of tasteful motion: page/tab transitions, staggered lists, animated drawers, skeletons, empty states.

HIERARCHY + ACCESS
- Fully expandable hierarchy: institution → school → programme → batch → section. Admins can create new institutions/schools/programmes/batches from cascading selectors with "+ New" options.
- Roles: student, moderator, admin, stored in a separate user_roles table with a security-definer has_role() function (never roles on profiles).
- Signup restricted to @learner.manipal.edu with email verification; user picks their batch at signup and gets an auto membership for it. No self-service "request access" button — admins/moderators grant or elevate access from a Members tab.
- Everything batch-sensitive is invisible when signed out: signed-out visitors only ever see a rich animated marketing landing page (hero, feature sections, list of famous MAHE institutions, CTA). All Supabase access must be guarded so a missing backend config renders "signed out" instead of throwing.

TABS (batch-scoped, realtime)
1. Feed — announcements strip, today's timetable card, ongoing/upcoming/completed deadline columns, "Day Pulse" animated progress of the day's classes with hours/minutes remaining, animated break banner when a gap is running, and per-class "Mark absent" buttons.
2. Calendar — month/week/agenda views, event-type filters + search + add, distinct shapes per type (circle = class, hexagon = holiday, others for quiz/assignment/presentation/exam), click a date to focus its agenda, animated event drawer, moderator/admin edit + delete for every entry, ICS + Google Calendar export.
3. Timetable — monthly prev/next/Today navigation (no week shifting), auto-derived subject list per batch with collision-free distinct colors spread around the hue wheel, lecture labels as S{session number} from the source data, filter chips per deadline type that grey out when empty, multi-select rows with bulk mark-absent / clear / delete.
4. Attendance — donut chart for overall attendance plus subject-wise meters; bands: ≥85% green (hue scales with %), 70–85% amber, <70% red; planned totals configurable per subject with fallback to actual scheduled classes; absent-only marking (clicking an active mark clears it); mobile-friendly subject formatting; CSV export.
5. Announcements — batch announcements with a recent strip on Feed.
6. Members — roster visible to approved members; grant/elevate controls for moderators and admins.
7. Notifications — derived activity feed (joins, announcements, new deadlines).
8. Feedback — bugs, suggestions and feature requests sent to admins.
9. Profile (/profile) — editable details (name, avatar, bio, links, timezone, reminder lead time) with some permanent fields locked, completeness ring, dirty-state save/reset bar, validation.

DATA IMPORT
- Moderators can paste a public .ics timetable URL per batch; the server fetches it with SSRF-safe validation (https only, no credentials, block localhost/private/link-local/metadata/CGNAT/multicast, validate every redirect hop), upserts sessions in chunks, tracks sync leases and failures, and derives course + faculty metadata automatically, assigning colors to unseen subjects.
- Also expose a tokenized read-only ICS export endpoint under /api/public/ics/$token, with tokens stored in a backend-only table.

SECURITY
- RLS on every table with explicit GRANTs; permission helper functions live in a private schema, not executable by anon.
- Profiles visible only to self, approved batchmates, and moderators/admins; user_roles readable only by self/admin.

Also give every route unique SEO head metadata, a sitemap, and responsive mobile layouts throughout.
```

## Notes

- Paste it in one go; Lovable will build the foundation first, then you can refine tab by tab.
- Trim the tabs you don't need — the hierarchy, roles and RLS paragraphs are the parts worth keeping verbatim.
