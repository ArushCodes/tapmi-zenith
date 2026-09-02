import type { ClassSession, Course } from "@/lib/batches";

export const FALLBACK_COURSE_COLOR = "#64748B";

/** Palette used when a batch has no catalogue colour yet — every distinct
 *  subject still gets its own stable colour, derived from its name. */
const AUTO_PALETTE = [
  "#22D3EE",
  "#A78BFA",
  "#F59E0B",
  "#34D399",
  "#F472B6",
  "#60A5FA",
  "#FB923C",
  "#4ADE80",
  "#E879F9",
  "#38BDF8",
  "#FACC15",
  "#FCA5A5",
  "#2DD4BF",
  "#C084FC",
  "#F87171",
  "#818CF8",
];

/** Stable colour for any subject label, so new batches are coloured instantly. */
export function autoColor(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AUTO_PALETTE[h % AUTO_PALETTE.length]!;
}

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
    (s.is_holiday ? null : autoColor(sessionKey(s)))
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

/** Clean display name — drops the "- S10 - Faculty" tail feeds tack on. */
export function sessionLabel(s: ClassSession) {
  const base = s.is_holiday ? s.title : (s.short_name ?? s.course_name ?? s.title);
  return (
    base
      .replace(/^\s*S\d+\s*[-–·]\s*/i, "")
      .replace(/\s*[-–·]\s*S\d+\b.*$/i, "")
      .trim() || s.title
  );
}

/** Session number if the feed encoded one, e.g. "… - S10 - Pratik". */
export function sessionNumberOf(s: ClassSession) {
  if (s.session_number) return s.session_number;
  const m = /[-–·]\s*S(\d+)\b/i.exec(s.title);
  return m ? Number(m[1]) : null;
}

/** Key used for subject filtering — course code when known, else the title. */
export function sessionKey(s: ClassSession) {
  if (s.is_holiday) return HOLIDAY_KEY;
  return (s.course_code ?? s.short_name ?? s.title).toLowerCase();
}


export function courseKey(c: Course) {
  return c.code.toLowerCase();
}
