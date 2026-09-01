/** Registro (edtex) timetable sync — server only. */
const BASE = "https://registro-tapmi-manipal.edtex.in/api/";
const BASE_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Referer: "https://registro-tapmi-manipal.edtex.in/",
  Origin: "https://registro-tapmi-manipal.edtex.in",
};

export type RegistroItem = {
  start?: string;
  end?: string;
  title?: string;
  course?: string;
  professor?: string;
  section?: string;
  classroom_name?: string;
  session_number?: number;
  is_holiday?: boolean;
};

export async function authenticate(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/authenticate`, {
    method: "POST",
    headers: { ...BASE_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: 0,
      username,
      password,
      totp: "",
      rememberMe: true,
      version: "v1.0.0",
    }),
  });
  if (!res.ok) throw new Error(`Registro login failed (${res.status})`);

  for (const key of ["token", "authorization", "x-auth-token"]) {
    const val = res.headers.get(key);
    if (val && val.length > 20) return val.replace("Bearer ", "").trim();
  }
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const pools = [body, (body?.["data"] ?? null) as Record<string, unknown> | null];
  for (const pool of pools) {
    if (!pool) continue;
    for (const k of ["id_token", "jwt", "access_token", "token"]) {
      const val = pool[k];
      if (typeof val === "string" && val.length > 20) return val.replace("Bearer ", "").trim();
    }
  }
  throw new Error("Could not extract Registro token from login response");
}

export async function fetchTimetable(token: string, termId: string): Promise<RegistroItem[]> {
  const res = await fetch(`${BASE}/api/student-term-sessions-for-timetable/${termId}/true`, {
    headers: { ...BASE_HEADERS, token },
  });
  if (!res.ok) throw new Error(`Registro timetable fetch failed (${res.status})`);
  const json = (await res.json()) as { data?: RegistroItem[] };
  return json.data ?? [];
}

async function stableId(raw: string) {
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type CourseMap = { code: string; name: string; short_name: string; faculty_name: string | null };

function matchCourse(item: RegistroItem, courses: CourseMap[]) {
  const course = (item.course ?? "").trim().toLowerCase();
  const title = (item.title ?? "").trim().toLowerCase();
  return (
    courses.find((c) => c.name.trim().toLowerCase() === course) ??
    courses.find((c) => title.includes(c.code.toLowerCase())) ??
    courses.find((c) => course.includes(c.code.toLowerCase())) ??
    null
  );
}

function firstName(professor: string | undefined) {
  if (!professor) return null;
  const parts = professor.replace(/Dr\.?|Prof\.?/gi, "").trim().split(/\s+/).filter(Boolean);
  return parts[0] ?? null;
}

export type NormalisedSession = {
  batch_id: string;
  source: "registro";
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

export async function normalise(
  items: RegistroItem[],
  batchId: string,
  courses: CourseMap[],
): Promise<NormalisedSession[]> {
  const out: NormalisedSession[] = [];
  for (const item of items) {
    if (!item.start || !item.end) continue;
    const matched = matchCourse(item, courses);
    const faculty = matched?.faculty_name ?? firstName(item.professor);
    const short = matched?.short_name ?? item.course ?? item.title ?? "Class";
    const uid = await stableId(
      `${item.start}-${item.course ?? ""}-${item.session_number ?? ""}-${item.title ?? ""}`,
    );
    const title = item.is_holiday
      ? `🎉 ${item.title ?? "Holiday"}`
      : [short, item.session_number != null ? `S${item.session_number}` : null, faculty]
          .filter(Boolean)
          .join(" - ");

    out.push({
      batch_id: batchId,
      source: "registro",
      external_uid: uid,
      title,
      course_code: matched?.code ?? null,
      course_name: matched?.name ?? item.course ?? null,
      short_name: short,
      faculty_name: faculty,
      section: item.section ?? null,
      classroom: item.classroom_name ?? null,
      session_number: item.session_number ?? null,
      start_at: new Date(item.start).toISOString(),
      end_at: new Date(item.end).toISOString(),
      is_holiday: !!item.is_holiday,
    });
  }
  return out;
}

const LEASE_MINUTES = 10;
const MAX_FAILURES = 5;

/** Sync one batch. Returns a short result string. Throws on unexpected failure. */
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
    const { data: creds } = await supabaseAdmin
      .from("batch_registro_credentials")
      .select("*")
      .eq("batch_id", batchId)
      .maybeSingle();
    if (!creds) throw new Error("No Registro credentials configured for this batch");

    const { data: batch } = await supabaseAdmin
      .from("batches")
      .select("registro_term_id")
      .eq("id", batchId)
      .maybeSingle();
    const termId = creds.term_id ?? batch?.registro_term_id;
    if (!termId) throw new Error("No Registro term id configured for this batch");

    const { data: courses } = await supabaseAdmin
      .from("courses")
      .select("code, name, short_name, faculty_name")
      .eq("batch_id", batchId);

    const token = await authenticate(creds.username, creds.password);
    const items = await fetchTimetable(token, termId);
    const rows = await normalise(items.slice(0, 2000), batchId, courses ?? []);

    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabaseAdmin
        .from("class_sessions")
        .upsert(rows.slice(i, i + 200), { onConflict: "batch_id,external_uid" });
      if (error) throw new Error(error.message);
    }

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
      last_error: err instanceof Error ? err.message : String(err),
      paused: failures >= MAX_FAILURES,
    });
    throw err;
  }
}
