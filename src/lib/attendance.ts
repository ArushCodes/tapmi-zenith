import type { AttendanceMark, ClassSession } from "@/lib/batches";

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
  return s.short_name ?? s.course_name ?? s.title;
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
