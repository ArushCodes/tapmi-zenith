import type { AttendanceMark, ClassSession } from "@/lib/batches";
import { sessionLabel } from "@/lib/courses";

/** Planned number of sessions per subject for the trimester.
 *  Keyed by a normalised subject name so ICS short names match. */
export const PLANNED_SESSIONS: Record<string, number> = {
  psychology: 24,
  sociology: 24,
  english: 24,
  mathematics: 24,
  maths: 24,
  statistics: 24,
  spreadsheets: 16,
  ai: 16,
  "team building": 8,
};

export function subjectKeyOf(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Nicely shortened label for tight mobile layouts. */
export function shortSubject(name: string, max = 18) {
  const clean = name.replace(/\s*-\s*S\d+\s*-\s*.*$/i, "").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Planned total for a subject. The scheduled count always wins when it is
 *  bigger, so batches with subjects outside the map still work correctly. */
export function plannedFor(subject: string, fallback: number) {
  const planned = PLANNED_SESSIONS[subjectKeyOf(subject)];
  return planned ? Math.max(planned, fallback) : fallback;
}

export type Band = "good" | "warn" | "risk";

export function bandFor(pct: number): Band {
  if (pct >= 85) return "good";
  if (pct >= 70) return "warn";
  return "risk";
}

/** TAPMI IPM policy — 85% keeps you clear, 70% is the hard line. */
export const SAFE_LINE = 85;
export const HARD_LINE = 70;

export const BAND_COPY: Record<Band, { label: string; detail: string }> = {
  good: {
    label: "Clear",
    detail: "At or above 85% — eligible for the end-term exam.",
  },
  warn: {
    label: "Repeat exam",
    detail: "Between 70% and 85% — blocked from the main exam, repeat exam only.",
  },
  risk: {
    label: "Fail",
    detail: "Below 70% — the course is failed on attendance.",
  },
};

/** Credits inferred from the planned session count: 8 → 1 credit, 16 → 2, 24 → 3. */
export function creditsFor(planned: number) {
  return Math.max(1, Math.round(planned / 8));
}

/** Holidays you may take: one per credit (8 sessions = 1 credit). */
export function allowanceFor(planned: number) {
  return creditsFor(planned);
}

/** Absences you may take before dropping under the 70% hard line. */
export function hardAllowanceFor(planned: number) {
  return Math.max(0, Math.floor(planned * (1 - HARD_LINE / 100)));
}


/** Green above 85 (deeper green the higher), amber 70–85, red below 70. */
export function meterColor(pct: number) {
  if (pct >= 85) {
    const t = Math.min(1, Math.max(0, (pct - 85) / 15));
    const hue = 96 + t * 52; // 96 → 148
    return `hsl(${hue.toFixed(0)} 70% ${(52 - t * 8).toFixed(0)}%)`;
  }
  if (pct >= 70) {
    const t = (pct - 70) / 15;
    const hue = 34 + t * 16; // 34 → 50
    return `hsl(${hue.toFixed(0)} 92% 55%)`;
  }
  const t = Math.min(1, Math.max(0, pct / 70));
  const hue = 0 + t * 14;
  return `hsl(${hue.toFixed(0)} 82% 58%)`;
}

/** Course label used to group sessions for attendance. */
export function sessionSubject(s: ClassSession) {
  return sessionLabel(s);
}

/** Rep marks win over self marks for the same session. */
export function resolveMarks(marks: AttendanceMark[], userId: string | undefined) {
  const resolved = new Map<string, AttendanceMark>();
  for (const m of marks) {
    if (m.user_id !== userId) continue;
    const existing = resolved.get(m.session_id);
    if (!existing || m.mark_source === "rep") resolved.set(m.session_id, m);
  }
  return resolved;
}

/** Last scheduled class of the current trimester — read straight from the
 *  timetable, so the quota window follows the calendar rather than a constant. */
export function trimesterEnd(sessions: ClassSession[], now: number) {
  let last = 0;
  for (const s of sessions) {
    const t = new Date(s.end_at).getTime();
    if (t > last) last = t;
  }
  return last > now ? last : null;
}

/** "2 months, 3 days" — how long until the holiday quota resets. */
export function untilReset(endMs: number, now: number) {
  const from = new Date(now);
  const to = new Date(endMs);
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  const anchor = new Date(from);
  anchor.setMonth(anchor.getMonth() + months);
  if (anchor.getTime() > endMs) {
    months -= 1;
    anchor.setMonth(anchor.getMonth() - 1);
  }
  const days = Math.max(0, Math.round((endMs - anchor.getTime()) / 86_400_000));
  const parts: string[] = [];
  if (months > 0) parts.push(`${months} month${months === 1 ? "" : "s"}`);
  parts.push(`${days} day${days === 1 ? "" : "s"}`);
  return parts.join(", ");
}
