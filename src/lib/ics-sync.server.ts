/** Timetable sync from a public .ics feed — server only. */

export const COURSE_PALETTE = [
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
];

import { FeedError, fetchPublicFeed } from "./safe-url";

export type IcsEvent = Record<string, string>;

/** Unfold RFC5545 continuation lines and split into VEVENT property maps. */
export function parseIcs(text: string): IcsEvent[] {
  const unfolded = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  const events: IcsEvent[] = [];
  let current: IcsEvent | null = null;
  for (const line of unfolded.split("\n")) {
    if (line.startsWith("BEGIN:VEVENT")) current = {};
    else if (line.startsWith("END:VEVENT")) {
      if (current) events.push(current);
      current = null;
    } else if (current) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const key = line.slice(0, idx).split(";")[0]!.toUpperCase();
      current[key] = line.slice(idx + 1);
    }
  }
  return events;
}

function unescapeIcs(v: string | undefined) {
  return (v ?? "")
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/** Handles 20260811T044500Z, 20260811T044500 and 20260811 forms. */
function parseIcsDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(v);
  if (!m) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const [, y, mo, d, hh = "00", mi = "00", ss = "00", z] = m;
  const iso = `${y}-${mo}-${d}T${hh}:${mi}:${ss}${z ? "Z" : "Z"}`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function field(desc: string, label: string) {
  const re = new RegExp(`${label}:\\s*(.+)`, "i");
  const line = desc.split("\n").find((l) => re.test(l));
  return line ? re.exec(line)![1]!.trim() : null;
}

export type NormalisedSession = {
  batch_id: string;
  source: "ics";
  external_uid: string;
  title: string;
  course_code: string | null;
  course_name: string | null;
  short_name: string | null;
  faculty_name: string | null;
  section: string | null;
  classroom: string | null;
  session_number: number | null;
  start_at: string;
  end_at: string;
  is_holiday: boolean;
};

export function normaliseIcs(events: IcsEvent[], batchId: string): NormalisedSession[] {
  const out: NormalisedSession[] = [];
  for (const ev of events) {
    const start = parseIcsDate(ev["DTSTART"]);
    const end = parseIcsDate(ev["DTEND"]) ?? start;
    if (!start || !end) continue;

    const summary = unescapeIcs(ev["SUMMARY"]).trim() || "Class";
    const desc = unescapeIcs(ev["DESCRIPTION"]);
    const isHoliday = /^🎉/.test(summary) || /holiday/i.test(summary);

    const courseName = field(desc, "Course");
    const faculty = field(desc, "Faculty");
    const section = field(desc, "Section");
    const slot = field(desc, "Slot");
    // "Term 1 : MGT 1101 - MMT(S1)-3" → code "MGT 1101", session 3
    const codeMatch = slot ? /:\s*([A-Z]{2,4}\s?\d{3,4})/.exec(slot) : null;
    const sessionMatch = slot ? /-(\d+)\s*$/.exec(slot) : /-\s*S(\d+)\s*-/.exec(summary);

    const parts = summary.split(" - ").map((p) => p.trim());
    const shortName = isHoliday ? null : (parts[0] ?? summary);

    out.push({
      batch_id: batchId,
      source: "ics",
      external_uid: (ev["UID"] ?? `${start}-${summary}`).trim().slice(0, 200),
      title: summary,
      course_code: codeMatch ? codeMatch[1]!.replace(/\s+/g, " ") : null,
      course_name: courseName,
      short_name: shortName,
      faculty_name: faculty,
      section,
      classroom: unescapeIcs(ev["LOCATION"]).trim() || null,
      session_number: sessionMatch ? Number(sessionMatch[1]) : null,
      start_at: start,
      end_at: end,
      is_holiday: isHoliday,
    });
  }
  return out;
}

const LEASE_MINUTES = 10;
const MAX_FAILURES = 5;

/** Sync one batch from its ICS URL. Returns a short result string. */
export async function syncBatch(batchId: string, force = false): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: state } = await supabaseAdmin
    .from("batch_sync_state")
    .select("*")
    .eq("batch_id", batchId)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  if (!force) {
    if (state?.paused) return "paused";
    if (state?.lease_until && state.lease_until > nowIso) return "locked";
  }

  await supabaseAdmin.from("batch_sync_state").upsert({
    batch_id: batchId,
    lease_until: new Date(Date.now() + LEASE_MINUTES * 60_000).toISOString(),
    last_run_at: nowIso,
  });

  try {
    const { data: batch } = await supabaseAdmin
      .from("batches")
      .select("ics_url")
      .eq("id", batchId)
      .maybeSingle();
    const url = batch?.ics_url;
    if (!url) throw new FeedError("No calendar (.ics) link configured for this batch");

    const res = await fetchPublicFeed(url);
    if (!res.ok) throw new FeedError("Could not download the calendar from that link");
    const text = await res.text();
    if (!text.includes("BEGIN:VCALENDAR")) throw new FeedError("That link did not return a calendar");

    const rows = normaliseIcs(parseIcs(text), batchId).slice(0, 5000);

    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabaseAdmin
        .from("class_sessions")
        .upsert(rows.slice(i, i + 200), { onConflict: "batch_id,external_uid" });
      if (error) throw new Error(error.message);
    }

    await syncCourses(batchId, rows);

    await supabaseAdmin.from("batch_sync_state").upsert({
      batch_id: batchId,
      lease_until: null,
      last_success_at: new Date().toISOString(),
      consecutive_failures: 0,
      last_error: null,
      last_count: rows.length,
      paused: false,
    });
    return `synced ${rows.length} sessions`;
  } catch (err) {
    const failures = (state?.consecutive_failures ?? 0) + 1;
    await supabaseAdmin.from("batch_sync_state").upsert({
      batch_id: batchId,
      lease_until: null,
      consecutive_failures: failures,
      last_error: err instanceof FeedError ? err.message : "Calendar sync failed",
      paused: failures >= MAX_FAILURES,
    });
    throw err;
  }
}

/** Derive the course catalogue from synced sessions and give each a unique colour. */
async function syncCourses(batchId: string, rows: NormalisedSession[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const map = new Map<string, { name: string; short: string; faculty: string | null }>();
  for (const r of rows) {
    if (r.is_holiday) continue;
    // Feeds without a slot code still get a catalogue entry keyed by subject name.
    const code = r.course_code ?? r.short_name ?? r.course_name;
    if (!code) continue;
    if (!map.has(code))
      map.set(code, {
        name: r.course_name ?? r.short_name ?? code,
        short: r.short_name ?? code,
        faculty: r.faculty_name,
      });
  }

  if (map.size === 0) return;

  const { data: existing } = await supabaseAdmin
    .from("courses")
    .select("code, color")
    .eq("batch_id", batchId);

  const used = new Set((existing ?? []).map((c) => c.color).filter(Boolean) as string[]);
  const byCode = new Map((existing ?? []).map((c) => [c.code, c.color]));

  const payload = [...map.entries()].map(([code, v]) => {
    let color = byCode.get(code) ?? null;
    if (!color) {
      color = COURSE_PALETTE.find((c) => !used.has(c)) ?? COURSE_PALETTE[used.size % COURSE_PALETTE.length]!;
      used.add(color);
    }
    return {
      batch_id: batchId,
      code,
      name: v.name,
      short_name: v.short,
      faculty_name: v.faculty,
      color,
    };
  });

  await supabaseAdmin.from("courses").upsert(payload, { onConflict: "batch_id,code" });
}
