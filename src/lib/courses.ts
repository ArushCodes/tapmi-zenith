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

/** Lookup of course code / short name / session key → colour.
 *  Every distinct subject in the batch is guaranteed a *unique* colour: the
 *  catalogue colour wins, collisions are pushed to the next free palette slot,
 *  and anything still unclaimed gets a generated hue that is not in use yet. */
export function buildColorMap(courses: Course[], sessions: ClassSession[] = []) {
  const m = new Map<string, string>();
  const used = new Set<string>();

  const claim = (preferred: string, seed: string) => {
    if (!used.has(preferred)) return preferred;
    const free = AUTO_PALETTE.find((c) => !used.has(c));
    if (free) return free;
    // Palette exhausted — walk the hue wheel deterministically until free.
    let h = 0;
    for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    for (let i = 0; i < 360; i += 1) {
      const c = `hsl(${(h + i * 37) % 360} 70% 62%)`;
      if (!used.has(c)) return c;
    }
    return preferred;
  };

  const assign = (keys: (string | null | undefined)[], preferred: string, seed: string) => {
    const known = keys.find((k) => k && m.has(k.toLowerCase()));
    if (known) {
      const color = m.get(known.toLowerCase())!;
      for (const k of keys) if (k) m.set(k.toLowerCase(), color);
      return;
    }
    const color = claim(preferred, seed);
    used.add(color);
    for (const k of keys) if (k) m.set(k.toLowerCase(), color);
  };

  for (const c of courses) {
    if (!c.color) continue;
    assign([c.code, c.short_name], c.color, c.code);
  }

  for (const s of sessions) {
    if (s.is_holiday || isAcademicEvent(s)) continue;
    const key = sessionKey(s);
    assign([s.course_code, s.short_name, key], autoColor(key), key);
  }

  return m;
}

export function sessionColor(s: ClassSession, map: Map<string, string>) {
  if (s.is_holiday) return null;
  return (
    (s.course_code && map.get(s.course_code.toLowerCase())) ||
    (s.short_name && map.get(s.short_name.toLowerCase())) ||
    map.get(sessionKey(s)) ||
    autoColor(sessionKey(s))
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
