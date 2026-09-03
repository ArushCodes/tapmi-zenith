import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle, CircleSlash, Download, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { db as supabase } from "@/lib/backend";
import { useAuth } from "@/hooks/use-auth";
import { useBatch } from "@/hooks/use-batch";
import { useMe } from "@/hooks/use-me";
import {
  attendanceQuery,
  batchMembersQuery,
  sessionsQuery,
  type AttendanceMark,
  type ClassSession,
} from "@/lib/batches";
import {
  BAND_COPY,
  CONTINUOUS_ABSENCE_DAYS,
  HARD_LINE,
  LEAVE_COPY,
  SAFE_LINE,
  TOTAL_CAP_PCT,
  bandFor,
  eligibilityMisses,
  gradePenalty,
  leaveCaps,
  longestAbsenceRun,
  meterColor,
  plannedFor,
  resolveMarks,
  safeMisses,
  sessionSubject,
  shortSubject,
  trimesterEnd,
  untilReset,
  type LeaveType,
} from "@/lib/attendance";
import { Donut } from "@/components/ui/donut";
import { SessionMeta } from "@/components/common/SessionMeta";
import { isTeachingClass, sessionLabel } from "@/lib/courses";


const termFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function AttendancePanel({ now, compact = false }: { now: number; compact?: boolean }) {
  const { user } = useAuth();
  const me = useMe();
  const { batchId, batch, canManage, isMember } = useBatch();
  const queryClient = useQueryClient();
  const [browse, setBrowse] = useState(false);
  const [q, setQ] = useState("");
  /** null = overall donut, otherwise a single subject. */
  const [focus, setFocus] = useState<string | null>(null);


  const { data: sessions = [] } = useQuery(sessionsQuery(batchId));
  const { data: marks = [] } = useQuery(attendanceQuery(batchId, isMember));
  const { data: members = [] } = useQuery(batchMembersQuery(batchId, canManage));

  const mark = useMutation({
    mutationFn: async (input: {
      session: ClassSession;
      userId: string;
      /** null clears an existing mark (tap the active button again). */
      status: AttendanceMark["status"] | null;
      source: AttendanceMark["mark_source"];
      leave?: LeaveType;
    }) => {
      if (input.status === null) {
        const { error } = await supabase
          .from("attendance_marks")
          .delete()
          .eq("session_id", input.session.id)
          .eq("user_id", input.userId)
          .eq("mark_source", input.source);
        if (error) throw error;
        return "cleared" as const;
      }
      const { error } = await supabase.from("attendance_marks").upsert(
        {
          session_id: input.session.id,
          batch_id: input.session.batch_id,
          user_id: input.userId,
          status: input.status,
          mark_source: input.source,
          leave_type: input.leave ?? "personal",
          marked_by: user!.id,
        },
        { onConflict: "session_id,user_id,mark_source" },
      );
      if (error) throw error;
      return "saved" as const;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["attendance", batchId] });
      toast.success(res === "cleared" ? "Attendance cleared" : "Attendance recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  /** Attendance is only for actual classes — calendar milestones, holidays and
   *  assessments such as quizzes or exams never appear as subjects. The rule
   *  lives in lib/courses so every batch and every page agrees. */
  const classes = useMemo(() => sessions.filter(isTeachingClass), [sessions]);


  /** Any class from the timetable, newest first, searchable. */
  const browsable = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return classes
      .filter((s) =>
        !needle
          ? true
          : [s.title, s.course_name, s.short_name, s.faculty_name, s.classroom]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(needle)),
      )
      .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());
  }, [classes, q]);

  const myMarks = useMemo(() => {
    const map = new Map<string, AttendanceMark>();
    for (const m of marks) if (m.user_id === user?.id) map.set(`${m.session_id}-${m.mark_source}`, m);
    return map;
  }, [marks, user?.id]);

  /** Marks that count as a leave, resolved rep-over-self, keyed by session. */
  const resolvedMine = useMemo(() => resolveMarks(marks, user?.id), [marks, user?.id]);

  const absentIds = useMemo(() => {
    const set = new Set<string>();
    for (const [id, m] of resolvedMine) if (m.status === "absent") set.add(id);
    return set;
  }, [resolvedMine]);

  /** Per-course stats following the IPM handbook: leaves are split into
   *  Personal and Institutional, each capped at 15% of the course's sessions,
   *  with 30% as the absolute combined wall. */
  const stats = useMemo(() => {
    const sessionById = new Map(classes.map((s) => [s.id, s]));

    const scheduled = new Map<string, number>();
    for (const s of classes) {
      const key = sessionSubject(s);
      scheduled.set(key, (scheduled.get(key) ?? 0) + 1);
    }

    type Row = { held: number; pl: number; il: number; present: number };
    const rows = new Map<string, Row>();
    for (const key of scheduled.keys()) rows.set(key, { held: 0, pl: 0, il: 0, present: 0 });
    for (const s of classes) {
      if (new Date(s.end_at).getTime() > now) continue;
      rows.get(sessionSubject(s))!.held += 1;
    }
    for (const [sessionId, m] of resolvedMine) {
      const s = sessionById.get(sessionId);
      if (!s) continue;
      const row = rows.get(sessionSubject(s));
      if (!row) continue;
      if (m.status !== "absent") {
        row.present += 1;
        continue;
      }
      if (m.leave_type === "institutional") row.il += 1;
      else row.pl += 1;
    }

    return [...rows.entries()]
      .map(([course, v]) => {
        const planned = plannedFor(course, scheduled.get(course) ?? v.held);
        const absent = v.pl + v.il;
        const attended = Math.max(0, planned - absent);
        const caps = leaveCaps(planned, v.pl);
        const pct = planned ? Math.round((attended / planned) * 100) : 100;
        return {
          course,
          planned,
          pl: v.pl,
          il: v.il,
          absent,
          present: v.present,
          held: v.held,
          attended,
          caps,
          plLeft: caps.personal - v.pl,
          ilLeft: caps.institutional - v.il,
          totalLeft: caps.total - absent,
          safeLeft: safeMisses(planned) - absent,
          eligibleLeft: eligibilityMisses(planned) - absent,
          penalty: gradePenalty(planned, absent),
          pct,
        };
      })
      .sort((a, b) => a.pct - b.pct);
  }, [resolvedMine, classes, now]);

  /** The leave budget belongs to the current trimester — its end is the last
   *  class on the calendar, and the budget resets after it. */
  const termEnd = useMemo(() => trimesterEnd(classes, now), [classes, now]);

  /** More than 13 continuous calendar days absent forces a withdrawal. */
  const longestRun = useMemo(
    () => longestAbsenceRun(classes, (s) => absentIds.has(s.id), now),
    [classes, absentIds, now],
  );

  /** Donut source: one subject when focused, else the whole trimester. */
  const overall = useMemo(() => {
    const rows = focus ? stats.filter((s) => s.course === focus) : stats;
    const planned = rows.reduce((a, s) => a + s.planned, 0);
    const pl = rows.reduce((a, s) => a + s.pl, 0);
    const il = rows.reduce((a, s) => a + s.il, 0);
    const absent = pl + il;
    const attended = Math.max(0, planned - absent);
    const caps = leaveCaps(planned, pl);
    return {
      planned,
      pl,
      il,
      absent,
      caps,
      plLeft: caps.personal - pl,
      ilLeft: caps.institutional - il,
      totalLeft: caps.total - absent,
      safeLeft: safeMisses(planned) - absent,
      eligibleLeft: eligibilityMisses(planned) - absent,
      penalty: gradePenalty(planned, absent),
      pct: planned ? Math.round((attended / planned) * 100) : 100,
    };
  }, [stats, focus]);


  const conflicts = useMemo(() => {
    const bySession = new Map<string, AttendanceMark[]>();
    for (const m of marks) bySession.set(`${m.session_id}|${m.user_id}`, [
      ...(bySession.get(`${m.session_id}|${m.user_id}`) ?? []),
      m,
    ]);
    return [...bySession.values()].filter(
      (list) => list.length > 1 && new Set(list.map((m) => m.status)).size > 1,
    );
  }, [marks]);

  function exportCsv() {
    const sessionById = new Map(classes.map((s) => [s.id, s]));
    const rows = [["Student", "Email", "Class", "Start", "Status", "Source", "Reason"]];
    const nameOf = new Map(
      members.map((m) => [m.user_id, m.profiles?.full_name ?? m.profiles?.email ?? m.user_id]),
    );
    const emailOf = new Map(members.map((m) => [m.user_id, m.profiles?.email ?? ""]));
    for (const m of marks) {
      const s = sessionById.get(m.session_id);
      rows.push([
        String(nameOf.get(m.user_id) ?? m.user_id),
        String(emailOf.get(m.user_id) ?? ""),
        s?.title ?? "",
        s?.start_at ?? "",
        m.status,
        m.mark_source,
        m.reason ?? "",
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${batch?.slug ?? "batch"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!isMember)
    return (
      <p className="mt-10 text-center font-mono text-xs text-faint">
        {me.name ? `${me.name}, attendance` : "Attendance"} is visible to approved batch members.
        Request access from the batch selector.
      </p>
    );

  return (
    <section className="mt-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
          {me.possessive ? `${me.possessive} attendance` : "Attendance"}
        </p>
        {canManage && !compact && (
          <button
            onClick={exportCsv}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-surface2 px-2.5 py-1.5 font-mono text-[11px] text-dim ring-1 ring-border hover:text-ink"
          >
            <Download className="size-3.5" /> Export CSV
          </button>
        )}
      </div>

        <div className="flex flex-col gap-4">

          {conflicts.length > 0 && canManage && (

            <p className="flex items-center gap-2 rounded-lg bg-evt-quiz/10 px-3 py-2 font-mono text-[11px] text-evt-quiz ring-1 ring-evt-quiz/30">
              <AlertTriangle className="size-3.5" /> {conflicts.length} record(s) where a self-mark
              and a rep mark disagree.
            </p>
          )}
          {stats.length === 0 ? (
            <p className="mt-6 text-center font-mono text-xs text-faint">
              {me.name ? `${me.name}, no classes on record yet.` : "No classes on record yet."}
            </p>
          ) : (
            <>
              <div className="flex flex-col items-center gap-5 rounded-2xl bg-surface p-4 ring-1 ring-border sm:flex-row sm:items-center">
                <Donut
                  value={overall.pct}
                  color={meterColor(overall.pct)}
                  size={150}
                  thresholds={[HARD_LINE, SAFE_LINE]}
                  label={`${overall.pct}%`}
                  sub={focus ? shortSubject(focus, 16) : "overall"}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-semibold">
                    {focus ? shortSubject(focus, 28) : "All subjects"}
                  </p>
                  <p className="mt-1 font-mono text-[11px] leading-relaxed text-dim">
                    {overall.absent} of {overall.planned} sessions missed ·{" "}
                    {overall.safeLeft >= 0
                      ? `${overall.safeLeft} more before grade cuts start`
                      : overall.eligibleLeft >= 0
                        ? `${overall.eligibleLeft} more before you lose exam eligibility`
                        : "past the 70% eligibility line"}
                  </p>
                  {termEnd && (
                    <p className="mt-1 font-mono text-[10px] leading-relaxed text-faint">
                      Leave budget runs to {termFmt.format(new Date(termEnd))} · resets in{" "}
                      {untilReset(termEnd, now)}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <BandChip pct={overall.pct} />
                    <PenaltyChip pct={overall.pct} penalty={overall.penalty} />
                  </div>
                  <ThresholdBar pct={overall.pct} />
                  <LeaveBudget
                    pl={overall.pl}
                    il={overall.il}
                    absent={overall.absent}
                    caps={overall.caps}
                  />
                  {longestRun.days > CONTINUOUS_ABSENCE_DAYS && (
                    <p className="mt-2 flex items-start gap-2 rounded-lg bg-rose/10 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-rose ring-1 ring-rose/30">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      {longestRun.days} continuous calendar days absent (
                      {termFmt.format(new Date(longestRun.from))} –{" "}
                      {termFmt.format(new Date(longestRun.to))}). Anything over{" "}
                      {CONTINUOUS_ABSENCE_DAYS} days without the Director's approval means
                      withdrawal from the programme.
                    </p>
                  )}


                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setFocus(null)}
                      className={`rounded-lg px-2.5 py-1 font-mono text-[10px] ring-1 ${
                        focus === null ? "bg-surface2 text-ink ring-cyan/40" : "text-dim ring-border"
                      }`}
                    >
                      Overall
                    </button>
                    {stats.map((s) => (
                      <button
                        key={s.course}
                        onClick={() => setFocus(focus === s.course ? null : s.course)}
                        className={`rounded-lg px-2.5 py-1 font-mono text-[10px] ring-1 ${
                          focus === s.course
                            ? "bg-surface2 text-ink ring-cyan/40"
                            : "text-dim ring-border hover:text-ink"
                        }`}
                      >
                        {shortSubject(s.course, 14)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">

                {stats.map((s) => {
                  const color = meterColor(s.pct);
                  return (
                    <motion.button
                      key={s.course}
                      layout
                      onClick={() => setFocus(focus === s.course ? null : s.course)}
                      whileHover={{ scale: 1.01, y: -2 }}
                      whileTap={{ scale: 0.99 }}
                      className={`rounded-xl bg-surface p-3 text-left ring-1 ${
                        focus === s.course ? "ring-cyan/40" : "ring-border"
                      }`}
                      style={{ boxShadow: `inset 0 0 0 1px ${color}44` }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-display text-sm font-semibold">
                          {shortSubject(s.course, 22)}
                        </span>
                        <span className="shrink-0 font-mono text-sm" style={{ color }}>
                          {s.pct}%
                        </span>
                      </div>
                      <ThresholdBar pct={s.pct} />
                      <LeaveBudget pl={s.pl} il={s.il} absent={s.absent} caps={s.caps} />
                      <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-dim">
                        {s.absent} of {s.planned} missed ·{" "}
                        {s.pct < HARD_LINE ? (
                          <span className="text-rose">
                            Incomplete (I) — repeat the course next year
                          </span>
                        ) : s.penalty > 0 ? (
                          <span className="text-amber">
                            −{s.penalty.toFixed(1)} grade points · {Math.max(0, s.eligibleLeft)}{" "}
                            left before {HARD_LINE}%
                          </span>
                        ) : (
                          <span className="text-evt-present">
                            no penalty · {Math.max(0, s.safeLeft)} miss
                            {s.safeLeft === 1 ? "" : "es"} left at {SAFE_LINE}%
                          </span>
                        )}
                      </p>


                    </motion.button>
                  );
                })}
              </div>
            </>
          )}

          {!compact && (
          <section className="rounded-2xl bg-surface p-4 ring-1 ring-border">
            <button
              onClick={() => setBrowse((v) => !v)}
              className="flex w-full items-center gap-2 font-display text-sm font-semibold"
            >
              <Search className="size-4 text-cyan" />
              Mark a past class absent
              <span className="ml-auto font-mono text-[11px] text-faint">
                {browse ? "Hide" : "Open"}
              </span>
            </button>

            {browse && (
              <div className="mt-3 flex flex-col gap-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search a class, faculty or room"
                  className="rounded-lg bg-ground px-3 py-2 text-sm text-ink outline-none ring-1 ring-border placeholder:text-faint focus:ring-cyan/50"
                />
                {browsable.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    tone={new Date(s.end_at).getTime() < now ? "past" : "upcoming"}
                    myMark={myMarks.get(`${s.id}-self`) ?? null}
                    canManage={canManage}
                    members={members}
                    marks={marks}
                    meId={user!.id}
                    onMark={(status, userId, source, leave) =>
                      mark.mutate({ session: s, userId, status, source, leave })
                    }
                  />
                ))}
              </div>
            )}
          </section>
          )}

          {!compact && <PolicyCard />}
        </div>

    </section>
  );
}

/** Personal / Institutional leave usage against their handbook caps. */
function LeaveBudget({
  pl,
  il,
  absent,
  caps,
}: {
  pl: number;
  il: number;
  absent: number;
  caps: { total: number; personal: number; institutional: number };
}) {
  const items: Array<{ key: LeaveType; used: number; cap: number }> = [
    { key: "personal", used: pl, cap: caps.personal },
    { key: "institutional", used: il, cap: caps.institutional },
  ];
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((it) => {
        const over = it.used > it.cap;
        return (
          <span
            key={it.key}
            title={LEAVE_COPY[it.key].help}
            className={`rounded-lg px-2 py-1 font-mono text-[10px] ring-1 ${
              over ? "bg-rose/10 text-rose ring-rose/30" : "text-dim ring-border"
            }`}
          >
            {LEAVE_COPY[it.key].short} {it.used}/{it.cap}
          </span>
        );
      })}
      <span
        title={`Absolute wall — beyond ${TOTAL_CAP_PCT}% of sessions the course is Incomplete`}
        className={`rounded-lg px-2 py-1 font-mono text-[10px] ring-1 ${
          absent > caps.total ? "bg-rose/10 text-rose ring-rose/30" : "text-dim ring-border"
        }`}
      >
        Total {absent}/{caps.total}
      </span>
    </div>
  );
}

/** Shows the 0.5-per-session grade cut once past the 85% safe line. */
function PenaltyChip({ pct, penalty }: { pct: number; penalty: number }) {
  if (pct < HARD_LINE)
    return (
      <span className="rounded-lg bg-rose/10 px-2 py-1 font-mono text-[10px] text-rose ring-1 ring-rose/30">
        Below {HARD_LINE}% · Incomplete
      </span>
    );
  if (penalty <= 0)
    return (
      <span className="rounded-lg px-2 py-1 font-mono text-[10px] text-evt-present ring-1 ring-evt-present/30">
        No grade penalty
      </span>
    );
  return (
    <span className="rounded-lg bg-amber/10 px-2 py-1 font-mono text-[10px] text-amber ring-1 ring-amber/30">
      −{penalty.toFixed(1)} grade points
    </span>
  );
}

/** The handbook rules, spelled out so nobody has to open the PDF. */
function PolicyCard() {
  return (
    <div className="rounded-2xl bg-surface p-4 font-mono text-[10px] leading-relaxed text-faint ring-1 ring-border">
      <p className="font-display text-sm font-semibold text-ink">How attendance is scored</p>
      <ul className="mt-2 flex flex-col gap-1">
        <li>
          <span className="text-dim">{SAFE_LINE}% and above</span> — clean, no penalty.
        </li>
        <li>
          <span className="text-dim">
            {HARD_LINE}–{SAFE_LINE}%
          </span>{" "}
          — {PENALTY_PER_SESSION} grade points lost per session missed past the {SAFE_LINE}% line.
        </li>
        <li>
          <span className="text-dim">Below {HARD_LINE}%</span> — Incomplete (I): the course has to be
          repeated.
        </li>
        <li>
          {LEAVE_COPY.personal.label} and {LEAVE_COPY.institutional.label} are capped at{" "}
          {PL_CAP_PCT}% each, and {TOTAL_CAP_PCT}% combined, of a course's sessions.
        </li>
        <li>
          More than {CONTINUOUS_ABSENCE_DAYS} continuous days absent without the Director's approval
          means withdrawal from the programme.
        </li>
      </ul>
    </div>
  );
}

/** Percentage bar with the 70% hard line and 85% safe line marked on it. */
function ThresholdBar({ pct }: { pct: number }) {
  return (
    <div className="mt-2">
      <div className="relative h-2 overflow-hidden rounded-full bg-surface2">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, pct)}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 22 }}
        className="h-full rounded-full"
        style={{ backgroundColor: meterColor(pct) }}
      />
      {[HARD_LINE, SAFE_LINE].map((line) => (
        <span
          key={line}
          title={`${line}% line`}
          className="absolute top-0 h-full w-px bg-ink/45"
          style={{ left: `${line}%` }}
        />
      ))}
      </div>
      <div className="relative mt-1 h-3">
        {[HARD_LINE, SAFE_LINE].map((line) => (
          <span
            key={line}
            className="absolute font-mono text-[9px] leading-none text-faint"
            style={{ left: `${line}%`, transform: "translateX(-50%)" }}
          >
            {line}%
          </span>
        ))}
      </div>
    </div>
  );
}

/** Which side of the 85 / 70 policy lines this percentage falls on. */
function BandChip({ pct }: { pct: number }) {
  const band = bandFor(pct);
  const tone =
    band === "good"
      ? "bg-evt-present/12 text-evt-present ring-evt-present/30"
      : band === "warn"
        ? "bg-amber/15 text-amber ring-amber/30"
        : "bg-rose/12 text-rose ring-rose/30";
  return (
    <span
      title={BAND_COPY[band].detail}
      className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-mono text-[10px] ring-1 ${tone}`}
    >
      {BAND_COPY[band].label}
    </span>
  );
}

function SessionCard({
  session,
  tone = "live",
  myMark,
  canManage,
  members,
  marks,
  onMark,
  meId,
}: {
  session: ClassSession;
  tone?: "live" | "upcoming" | "past";
  myMark: AttendanceMark | null;
  canManage: boolean;
  members: { user_id: string; status: string; profiles: { full_name: string | null; email: string | null } | null }[];
  marks: AttendanceMark[];
  onMark: (
    status: AttendanceMark["status"] | null,
    userId: string,
    source: AttendanceMark["mark_source"],
  ) => void;

  meId: string;
}) {
  const [roster, setRoster] = useState(false);
  const repMarks = useMemo(() => {
    const map = new Map<string, AttendanceMark>();
    for (const m of marks)
      if (m.session_id === session.id && m.mark_source === "rep") map.set(m.user_id, m);
    return map;
  }, [marks, session.id]);

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className={`rounded-xl bg-surface p-3 ring-1 ${
        tone === "live" ? "ring-cyan/30" : "ring-border"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <span className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
          <span className="block truncate font-display text-sm font-semibold leading-tight">
            {shortSubject(sessionLabel(session), 40)}
          </span>
          <span className="block font-mono text-xs leading-relaxed text-dim sm:text-sm">
            {timeFmt.format(new Date(session.start_at))}
          </span>
          <SessionMeta session={session} />

        </span>
        <button
          onClick={() => onMark(myMark?.status === "absent" ? null : "absent", meId, "self")}
          title={myMark?.status === "absent" ? "Tap again to clear" : "Mark absent"}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[11px] ring-1 sm:flex-none sm:justify-start ${
            myMark?.status === "absent"
              ? "bg-evt-exam/20 text-evt-exam ring-evt-exam/40"
              : "text-dim ring-border hover:text-ink"
          }`}
        >
          <CircleSlash className="size-3.5" />{" "}
          {myMark?.status === "absent" ? "Marked absent" : "Absent"}
        </button>


        {canManage && (
          <button
            onClick={() => setRoster((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-cyan ring-1 ring-border"
          >
            <Users className="size-3.5" /> Roster
          </button>
        )}
      </div>

      {roster && canManage && (
        <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
          {members
            .filter((m) => m.status === "approved")
            .map((m) => {
              const mk = repMarks.get(m.user_id);
              return (
                <div key={m.user_id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {m.profiles?.full_name ?? m.profiles?.email ?? m.user_id}
                  </span>
                  <button
                    onClick={() =>
                      onMark(mk?.status === "absent" ? null : "absent", m.user_id, "rep")
                    }
                    className={`rounded-md px-2 py-1 font-mono text-[10px] ring-1 ${
                      mk?.status === "absent"
                        ? "bg-evt-exam/20 text-evt-exam ring-evt-exam/40"
                        : "text-dim ring-border"
                    }`}
                  >
                    Absent
                  </button>

                </div>
              );
            })}
        </div>
      )}
    </motion.div>
  );
}
