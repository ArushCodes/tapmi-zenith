import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle, CircleSlash, Download, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  meterColor,
  plannedFor,
  resolveMarks,
  sessionSubject,
  shortSubject,
} from "@/lib/attendance";

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

type SubTab = "live" | "workbook";

export function AttendancePanel({ now }: { now: number }) {
  const { user } = useAuth();
  const me = useMe();
  const { batchId, batch, canManage, isMember } = useBatch();
  const queryClient = useQueryClient();
  const [subTab, setSubTab] = useState<SubTab>("live");
  const [browse, setBrowse] = useState(false);
  const [q, setQ] = useState("");

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


  const classes = useMemo(
    () => sessions.filter((s) => !s.is_holiday),
    [sessions],
  );

  const current = useMemo(() => {
    const window = 45 * 60_000;
    return classes.filter((s) => {
      const start = new Date(s.start_at).getTime();
      const end = new Date(s.end_at).getTime();
      return now >= start - window && now <= end + window;
    });
  }, [classes, now]);

  const upcoming = useMemo(
    () => classes.filter((s) => new Date(s.start_at).getTime() > now).slice(0, 6),
    [classes, now],
  );

  /** Recently finished classes still open for marking (last 7 days). */
  const recent = useMemo(() => {
    const window = 7 * 24 * 3600_000;
    return classes
      .filter((s) => {
        const end = new Date(s.end_at).getTime();
        return end < now && now - end <= window;
      })
      .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())
      .slice(0, 12);
  }, [classes, now]);

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
      .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())
      .slice(0, 60);
  }, [classes, q]);

  const myMarks = useMemo(() => {
    const map = new Map<string, AttendanceMark>();
    for (const m of marks) if (m.user_id === user?.id) map.set(`${m.session_id}-${m.mark_source}`, m);
    return map;
  }, [marks, user?.id]);

  /** Per-course stats: attendance is measured against the planned trimester
   *  session count, so every unexcused absence eats into the percentage. */
  const stats = useMemo(() => {
    const sessionById = new Map(classes.map((s) => [s.id, s]));
    const resolved = resolveMarks(marks, user?.id);

    const scheduled = new Map<string, number>();
    for (const s of classes) {
      const key = sessionSubject(s);
      scheduled.set(key, (scheduled.get(key) ?? 0) + 1);
    }

    const rows = new Map<string, { held: number; absent: number; present: number }>();
    for (const key of scheduled.keys()) rows.set(key, { held: 0, absent: 0, present: 0 });
    for (const s of classes) {
      if (new Date(s.end_at).getTime() > now) continue;
      const row = rows.get(sessionSubject(s))!;
      row.held += 1;
    }
    for (const [sessionId, m] of resolved) {
      const s = sessionById.get(sessionId);
      if (!s) continue;
      const row = rows.get(sessionSubject(s));
      if (!row) continue;
      if (m.status === "absent") row.absent += 1;
      else row.present += 1;
    }

    return [...rows.entries()]
      .map(([course, v]) => {
        const planned = plannedFor(course, scheduled.get(course) ?? v.held);
        const attended = Math.max(0, planned - v.absent);
        return {
          course,
          planned,
          absent: v.absent,
          present: v.present,
          held: v.held,
          attended,
          pct: planned ? Math.round((attended / planned) * 100) : 100,
        };
      })
      .sort((a, b) => a.pct - b.pct);
  }, [marks, classes, user?.id, now]);

  const threshold = Number(batch?.attendance_threshold ?? 75);

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
        <div className="flex rounded-lg bg-surface2/70 p-0.5 ring-1 ring-border">
          {(["live", "workbook"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setSubTab(v)}
              className={
                subTab === v
                  ? "rounded-md bg-surface px-3 py-1 font-mono text-[11px] text-ink"
                  : "rounded-md px-3 py-1 font-mono text-[11px] text-dim hover:text-ink"
              }
            >
              {v === "live" ? "Live tracker" : "Absentee workbook"}
            </button>
          ))}
        </div>
        {canManage && (
          <button
            onClick={exportCsv}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-surface2 px-2.5 py-1.5 font-mono text-[11px] text-dim ring-1 ring-border hover:text-ink"
          >
            <Download className="size-3.5" /> Export CSV
          </button>
        )}
      </div>

      {subTab === "live" ? (
        <div className="flex flex-col gap-5">
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
              Happening now{me.name ? ` · ${me.name}` : ""}
            </p>
            {current.length === 0 ? (
              <p className="font-mono text-[11px] text-faint">No class in progress.</p>
            ) : (
              current.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  myMark={myMarks.get(`${s.id}-self`) ?? null}
                  canManage={canManage}
                  members={members}
                  marks={marks}
                  onMark={(status, userId, source) =>
                    mark.mutate({ session: s, userId, status, source })
                  }
                  meId={user?.id ?? ""}
                />
              ))
            )}
          </div>

          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
              Next up
            </p>
            <div className="flex flex-col gap-2">
              {upcoming.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  tone="upcoming"
                  myMark={myMarks.get(`${s.id}-self`) ?? null}
                  canManage={canManage}
                  members={members}
                  marks={marks}
                  onMark={(status, userId, source) =>
                    mark.mutate({ session: s, userId, status, source })
                  }
                  meId={user?.id ?? ""}
                />
              ))}
              {upcoming.length === 0 && (
                <p className="font-mono text-[11px] text-faint">Nothing scheduled ahead.</p>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
              Recent classes · mark if {me.name ? `${me.name} missed` : "you missed"} one
            </p>
            <div className="flex flex-col gap-2">
              {recent.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  tone="past"
                  myMark={myMarks.get(`${s.id}-self`) ?? null}
                  canManage={canManage}
                  members={members}
                  marks={marks}
                  onMark={(status, userId, source) =>
                    mark.mutate({ session: s, userId, status, source })
                  }
                  meId={user?.id ?? ""}
                />
              ))}
              {recent.length === 0 && (
                <p className="font-mono text-[11px] text-faint">No classes in the last 7 days.</p>
              )}
            </div>
          </div>

          <div>
            <button
              onClick={() => setBrowse((v) => !v)}
              className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan transition-colors hover:text-ink"
            >
              {browse ? "− Hide" : "+ Mark any class from the timetable"}
            </button>
            {browse && (
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 rounded-lg bg-surface2 px-3 py-2 ring-1 ring-border">
                  <Search className="size-3.5 text-faint" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search subject, faculty or room"
                    className="w-full bg-transparent font-mono text-[11px] text-ink outline-none placeholder:text-faint"
                  />
                </label>
                {browsable.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    tone="past"
                    myMark={myMarks.get(`${s.id}-self`) ?? null}
                    canManage={canManage}
                    members={members}
                    marks={marks}
                    onMark={(status, userId, source) =>
                      mark.mutate({ session: s, userId, status, source })
                    }
                    meId={user?.id ?? ""}
                  />
                ))}
                {browsable.length === 0 && (
                  <p className="font-mono text-[11px] text-faint">No classes match that search.</p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
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
                  label={`${overall.pct}%`}
                  sub={focus ? shortSubject(focus, 16) : "overall"}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-semibold">
                    {focus ? shortSubject(focus, 28) : "All subjects"}
                  </p>
                  <p className="mt-1 font-mono text-[11px] leading-relaxed text-dim">
                    {overall.absent} missed of {overall.planned} planned ·{" "}
                    {overall.pct >= threshold
                      ? `${overall.pct - threshold}% of headroom above the ${threshold}% line`
                      : `${threshold - overall.pct}% below the ${threshold}% line`}
                  </p>
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
                  <motion.div
                    key={s.course}
                    layout
                    whileHover={{ scale: 1.01, y: -2 }}
                    className="rounded-xl bg-surface p-3 ring-1"
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
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, s.pct)}%` }}
                        transition={{ type: "spring", stiffness: 120, damping: 22 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    </div>
                    <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-faint">
                      {s.absent} missed of {s.planned} planned · {s.held} held so far
                      <br className="sm:hidden" />
                      <span className="sm:before:content-['_·_']">threshold {threshold}%</span>
                    </p>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
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
            {shortSubject(session.title, 40)}
          </span>
          <span className="block truncate font-mono text-[10px] leading-relaxed text-dim sm:text-[11px]">
            {[
              timeFmt.format(new Date(session.start_at)),
              session.faculty_name,
              session.classroom,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
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
