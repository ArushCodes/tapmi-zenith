import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, CircleSlash, Download, Users } from "lucide-react";
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

  const { data: sessions = [] } = useQuery(sessionsQuery(batchId));
  const { data: marks = [] } = useQuery(attendanceQuery(batchId, isMember));
  const { data: members = [] } = useQuery(batchMembersQuery(batchId, canManage));

  const mark = useMutation({
    mutationFn: async (input: {
      session: ClassSession;
      userId: string;
      status: AttendanceMark["status"];
      source: AttendanceMark["mark_source"];
    }) => {
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", batchId] });
      toast.success("Attendance recorded");
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

  const myMarks = useMemo(() => {
    const map = new Map<string, AttendanceMark>();
    for (const m of marks) if (m.user_id === user?.id) map.set(`${m.session_id}-${m.mark_source}`, m);
    return map;
  }, [marks, user?.id]);

  /** Per-course stats for the signed-in user (rep mark wins, self mark as fallback). */
  const stats = useMemo(() => {
    const byCourse = new Map<string, { held: number; present: number }>();
    const sessionById = new Map(classes.map((s) => [s.id, s]));
    const resolved = new Map<string, AttendanceMark>();
    for (const m of marks) {
      if (m.user_id !== user?.id) continue;
      const existing = resolved.get(m.session_id);
      if (!existing || m.mark_source === "rep") resolved.set(m.session_id, m);
    }
    for (const [sessionId, m] of resolved) {
      const s = sessionById.get(sessionId);
      if (!s) continue;
      const key = s.short_name ?? s.course_name ?? "Other";
      const row = byCourse.get(key) ?? { held: 0, present: 0 };
      row.held += 1;
      if (m.status === "present" || m.status === "late" || m.status === "excused") row.present += 1;
      byCourse.set(key, row);
    }
    return [...byCourse.entries()].map(([course, v]) => ({
      course,
      ...v,
      pct: v.held ? Math.round((v.present / v.held) * 100) : 100,
    }));
  }, [marks, classes, user?.id]);

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
              {me.name ? `${me.name}, no attendance recorded yet.` : "No attendance recorded yet."}
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {stats.map((s) => {
                const low = s.pct < threshold;
                const near = !low && s.pct < threshold + 5;
                return (
                  <motion.div
                    key={s.course}
                    whileHover={{ scale: 1.01 }}
                    className={`rounded-xl bg-surface p-3 ring-1 ${
                      low ? "ring-evt-exam/40" : near ? "ring-evt-quiz/40" : "ring-border"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm font-semibold">{s.course}</span>
                      <span
                        className={`font-mono text-sm ${
                          low ? "text-evt-exam" : near ? "text-evt-quiz" : "text-evt-present"
                        }`}
                      >
                        {s.pct}%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface2">
                      <div
                        className={`h-full rounded-full ${
                          low ? "bg-evt-exam" : near ? "bg-evt-quiz" : "bg-evt-present"
                        }`}
                        style={{ width: `${Math.min(100, s.pct)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 font-mono text-[10px] text-faint">
                      {s.present}/{s.held} attended · threshold {threshold}%
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
    status: AttendanceMark["status"],
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
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-sm font-semibold">{session.title}</span>
          <span className="block font-mono text-[11px] text-dim">
            {timeFmt.format(new Date(session.start_at))} · {session.classroom ?? "—"}
          </span>
        </span>
        <button
          onClick={() => onMark("present", meId, "self")}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[11px] ring-1 ${
            myMark?.status === "present"
              ? "bg-evt-present/20 text-evt-present ring-evt-present/40"
              : "text-dim ring-border hover:text-ink"
          }`}
        >
          <CheckCircle2 className="size-3.5" /> Present
        </button>
        <button
          onClick={() => onMark("absent", meId, "self")}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[11px] ring-1 ${
            myMark?.status === "absent"
              ? "bg-evt-exam/20 text-evt-exam ring-evt-exam/40"
              : "text-dim ring-border hover:text-ink"
          }`}
        >
          <CircleSlash className="size-3.5" /> Absent
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
                    onClick={() => onMark("present", m.user_id, "rep")}
                    className={`rounded-md px-2 py-1 font-mono text-[10px] ring-1 ${
                      mk?.status === "present"
                        ? "bg-evt-present/20 text-evt-present ring-evt-present/40"
                        : "text-dim ring-border"
                    }`}
                  >
                    P
                  </button>
                  <button
                    onClick={() => onMark("absent", m.user_id, "rep")}
                    className={`rounded-md px-2 py-1 font-mono text-[10px] ring-1 ${
                      mk?.status === "absent"
                        ? "bg-evt-exam/20 text-evt-exam ring-evt-exam/40"
                        : "text-dim ring-border"
                    }`}
                  >
                    A
                  </button>
                </div>
              );
            })}
        </div>
      )}
    </motion.div>
  );
}
