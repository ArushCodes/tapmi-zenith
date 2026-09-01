import type { ClassSession, Course } from "@/lib/batches";

export const FALLBACK_COURSE_COLOR = "#64748B";

/** Lookup of course code / short name → colour. */
export function buildColorMap(courses: Course[]) {
  const m = new Map<string, string>();
  for (const c of courses) {
    if (!c.color) continue;
    m.set(c.code.toLowerCase(), c.color);
    m.set(c.short_name.toLowerCase(), c.color);
  }
  return m;
}

export function sessionColor(s: ClassSession, map: Map<string, string>) {
  return (
    (s.course_code && map.get(s.course_code.toLowerCase())) ||
    (s.short_name && map.get(s.short_name.toLowerCase())) ||
    null
  );
}

/** Academic-calendar entries are stored as custom sessions tagged in notes. */
export function isAcademicEvent(s: ClassSession) {
  return s.notes === "academic-calendar";
}

/** Every holiday collapses into one filter bucket instead of one chip each. */
export const HOLIDAY_KEY = "__holiday";

export function isHoliday(s: ClassSession) {
  return s.is_holiday;
}

/** Key used for subject filtering — course code when known, else the title. */
export function sessionKey(s: ClassSession) {
  if (s.is_holiday) return HOLIDAY_KEY;
  return (s.course_code ?? s.short_name ?? s.title).toLowerCase();
}


export function courseKey(c: Course) {
  return c.code.toLowerCase();
}
