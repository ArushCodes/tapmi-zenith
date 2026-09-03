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
  if (pct >= SAFE_LINE) return "good";
  if (pct >= HARD_LINE) return "warn";
  return "risk";
}

/* ---------------------------------------------------------------------------
 * IPM handbook policy
 * ------------------------------------------------------------------------ */

/** 85%+ = no penalty, 70–85% = 0.5 grade points per session missed below 85%,
 *  below 70% = automatic Incomplete. */
export const SAFE_LINE = 85;
export const HARD_LINE = 70;

/** Personal Leave: personal / domestic / medical. Capped at 15% of sessions. */
export const PL_CAP_PCT = 15;
/** Institutional Leave: approved extracurricular / placement duty. 15% by
 *  default, extendable up to 30% when Personal Leave is left unused. */
export const IL_CAP_PCT = 15;
/** Absolute ceiling on PL + IL combined — beyond it the grade is Incomplete. */
export const TOTAL_CAP_PCT = 30;
/** Grade points lost per session missed below the 85% bracket. */
export const PENALTY_PER_SESSION = 0.5;
/** Continuous absence beyond this many calendar days forces a withdrawal
 *  unless the Director has approved it. */
export const CONTINUOUS_ABSENCE_DAYS = 13;

export type LeaveType = "personal" | "institutional";

export const LEAVE_COPY: Record<LeaveType, { short: string; label: string; detail: string }> = {
  personal: {
    short: "PL",
    label: "Personal leave",
    detail: "Personal, domestic or medical. No exam or quiz is ever re-conducted for it.",
  },
  institutional: {
    short: "IL",
    label: "Institutional leave",
    detail: "Approved extracurricular or placement duty, signed off by the institute.",
  },
};

export const BAND_COPY: Record<Band, { label: string; detail: string }> = {
  good: {
    label: "No penalty",
    detail: "85% or above — fully eligible for every exam, no grade deduction.",
  },
  warn: {
    label: "Grade deduction",
    detail:
      "70–85% — 0.5 grade points are cut for every session missed below the 85% mark.",
  },
  risk: {
    label: "Incomplete (I)",
    detail:
      "Below 70% — barred from the End-Term and Make-Up exams; the course must be repeated next year.",
  },
};

/** Leave budgets for a course, straight from the handbook percentages. */
export function leaveCaps(planned: number, personalUsed = 0) {
  const total = Math.floor((planned * TOTAL_CAP_PCT) / 100);
  const personal = Math.floor((planned * PL_CAP_PCT) / 100);
  const institutionalBase = Math.floor((planned * IL_CAP_PCT) / 100);
  // Unused Personal Leave can be handed to Institutional Leave, up to the 30% wall.
  const institutional = Math.min(total, Math.max(institutionalBase, total - personalUsed));
  return { total, personal, institutionalBase, institutional };
}

/** Sessions you may still miss before dropping out of the 85% bracket. */
export function safeMisses(planned: number) {
  return Math.floor((planned * (100 - SAFE_LINE)) / 100);
}

/** Sessions you may still miss before the 70% eligibility line. */
export function eligibilityMisses(planned: number) {
  return Math.floor((planned * (100 - HARD_LINE)) / 100);
}

/** Grade points lost: 0.5 for every session missed below the 85% threshold.
 *  Under 70% the grade is Incomplete instead, so no number is meaningful. */
export function gradePenalty(planned: number, absent: number) {
  const over = Math.max(0, absent - safeMisses(planned));
  return over * PENALTY_PER_SESSION;
}

/** Longest unbroken stretch of missed classes, measured in calendar days —
 *  more than 13 days means a withdrawal unless the Director approved it. */
export function longestAbsenceRun(
  classes: ClassSession[],
  isAbsent: (s: ClassSession) => boolean,
  now: number,
) {
  const past = [...classes]
    .filter((s) => new Date(s.end_at).getTime() <= now)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  let best = { days: 0, from: 0, to: 0 };
  let start: number | null = null;
  let end = 0;

  const close = () => {
    if (start === null) return;
    const days = Math.round((end - start) / 86_400_000) + 1;
    if (days > best.days) best = { days, from: start, to: end };
    start = null;
  };

  for (const s of past) {
    const day = new Date(s.start_at).setHours(0, 0, 0, 0);
    if (isAbsent(s)) {
      if (start === null) start = day;
      end = day;
    } else {
      close();
    }
  }
  close();
  return best;
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
