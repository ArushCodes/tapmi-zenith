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
 *  Colours are spread evenly around the hue wheel across every distinct
 *  subject in the batch, so no two subjects ever look alike — the more
 *  subjects there are, the wider they are spaced apart. */
export function buildColorMap(courses: Course[], sessions: ClassSession[] = []) {
  const m = new Map<string, string>();

  /** Group aliases (code / short name / session key) per distinct subject. */
  const groups = new Map<string, Set<string>>();
  const aliasToGroup = new Map<string, string>();

  const register = (keys: (string | null | undefined)[]) => {
    const alias = keys.filter(Boolean).map((k) => k!.toLowerCase());
    if (alias.length === 0) return;
    const existing = alias.map((a) => aliasToGroup.get(a)).find(Boolean);
    const id = existing ?? alias[0]!;
    const set = groups.get(id) ?? new Set<string>();
    for (const a of alias) {
      set.add(a);
      aliasToGroup.set(a, id);
    }
    groups.set(id, set);
  };

  for (const c of courses) register([c.code, c.short_name]);
  for (const s of sessions) {
    if (s.is_holiday || isAcademicEvent(s)) continue;
    register([s.course_code, s.short_name, sessionKey(s)]);
  }

  const ids = [...groups.keys()].sort();
  const n = Math.max(ids.length, 1);
  ids.forEach((id, i) => {
    // Golden-ratio offset keeps neighbouring subjects far apart in hue, and
    // alternating lightness separates hues that are close on large batches.
    const hue = Math.round(((i * 360) / n + 18) % 360);
    const light = i % 2 === 0 ? 62 : 52;
    const sat = i % 3 === 0 ? 78 : 66;
    const color = `hsl(${hue} ${sat}% ${light}%)`;
    for (const alias of groups.get(id)!) m.set(alias, color);
  });

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
