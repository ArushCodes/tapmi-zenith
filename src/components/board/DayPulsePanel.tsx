import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Coffee, CircleSlash, Sun } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useBatch } from "@/hooks/use-batch";
import { useMe } from "@/hooks/use-me";
import { attendanceQuery, sessionsQuery, type ClassSession } from "@/lib/batches";
import { buildColorMap, isAcademicEvent, sessionColor, sessionLabel } from "@/lib/courses";
import { coursesQuery } from "@/lib/batches";
import { FALLBACK_COURSE_COLOR } from "@/lib/courses";
import { shortSubject } from "@/lib/attendance";
import { Donut } from "@/components/ui/donut";
import { dayKey } from "@/lib/deadlines";
import { SessionMeta } from "@/components/common/SessionMeta";


const clock = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function pctOf(s: ClassSession, now: number) {
  const a = new Date(s.start_at).getTime();
  const b = new Date(s.end_at).getTime();
  if (now <= a) return 0;
  if (now >= b) return 100;
  return Math.round(((now - a) / (b - a)) * 100);
}

/** "How much of today is done" — animated day pulse. */
export function DayPulsePanel({ now, compact = false }: { now: number; compact?: boolean }) {
  const { batchId, isMember } = useBatch();
  const { user } = useAuth();
  const me = useMe();
  const queryClient = useQueryClient();
  const { data: sessions = [] } = useQuery(sessionsQuery(batchId));
  const { data: courses = [] } = useQuery(coursesQuery(batchId));
  const { data: marks = [] } = useQuery(attendanceQuery(batchId, isMember));
  const colorMap = useMemo(() => buildColorMap(courses, sessions), [courses, sessions]);

  /** My own self-marks for today's classes, keyed by session. */
  const myMarks = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of marks)
      if (m.user_id === user?.id && m.mark_source === "self") map.set(m.session_id, m.status);
    return map;
  }, [marks, user?.id]);

  const toggleAbsent = useMutation({
    mutationFn: async (s: ClassSession) => {
      if (myMarks.get(s.id) === "absent") {
        const { error } = await supabase
          .from("attendance_marks")
          .delete()
          .eq("session_id", s.id)
          .eq("user_id", user!.id)
          .eq("mark_source", "self");
        if (error) throw error;
        return "cleared" as const;
      }
      const { error } = await supabase.from("attendance_marks").upsert(
        {
          session_id: s.id,
          batch_id: s.batch_id,
          user_id: user!.id,
          status: "absent",
          mark_source: "self",
          marked_by: user!.id,
        },
        { onConflict: "session_id,user_id,mark_source" },
      );
      if (error) throw error;
      return "saved" as const;
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["attendance", batchId] });
      toast.success(r === "cleared" ? "Attendance cleared" : "Marked absent");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const today = useMemo(() => {
    const key = dayKey(new Date(now));
    return sessions
      .filter((s) => !isAcademicEvent(s) && dayKey(s.start_at) === key)
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [sessions, now]);

  const classes = today.filter((s) => !s.is_holiday);

  const stats = useMemo(() => {
    let total = 0;
    let done = 0;
    for (const s of classes) {
      const a = new Date(s.start_at).getTime();
      const b = new Date(s.end_at).getTime();
      total += b - a;
      done += Math.min(b - a, Math.max(0, now - a));
    }
    const pct = total ? Math.round((done / total) * 100) : 0;
    const remainingMin = Math.max(0, Math.round((total - done) / 60000));
    return {
      pct,
      remainingMin,
      totalMin: Math.round(total / 60000),
      finished: classes.filter((s) => new Date(s.end_at).getTime() <= now).length,
    };
  }, [classes, now]);

  const live = classes.find(
    (s) => now >= new Date(s.start_at).getTime() && now <= new Date(s.end_at).getTime(),
  );

  /** Gap between two classes — the moment worth celebrating. */
  const breakInfo = useMemo(() => {
    if (live || classes.length === 0) return null;
    const prev = [...classes]
      .reverse()
      .find((s) => new Date(s.end_at).getTime() <= now);
    const next = classes.find((s) => new Date(s.start_at).getTime() > now);
    if (!next) return null;
    const startsIn = Math.max(0, Math.round((new Date(next.start_at).getTime() - now) / 60000));
    return { prev, next, startsIn, beforeFirst: !prev };
  }, [classes, live, now]);

  const color = stats.pct >= 100 ? "var(--evt-present)" : "var(--cyan)";


  return (
    <section className={compact ? "" : "mt-4"}>
      <div className="mb-3 flex items-center gap-2">
        <Sun className="size-3.5 text-amber" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber">
          {compact ? "Today" : `Today's pulse${me.name ? ` · ${me.name}` : ""}`}
        </p>
      </div>

      <div className="rounded-2xl bg-surface p-4 ring-1 ring-border">
        {classes.length === 0 ? (
          <p className="py-4 text-center font-mono text-[11px] text-faint">
            {today.some((s) => s.is_holiday)
              ? "Holiday — no classes today."
              : "No classes scheduled today."}
          </p>
        ) : (
          <>
          <AnimatePresence>
            {breakInfo && (
              <BreakBanner
                key="break"
                startsIn={breakInfo.startsIn}
                nextLabel={shortSubject(sessionLabel(breakInfo.next), 26)}
                nextAt={clock.format(new Date(breakInfo.next.start_at))}
                prevLabel={breakInfo.prev ? shortSubject(sessionLabel(breakInfo.prev), 26) : null}
                name={me.name}
              />
            )}
          </AnimatePresence>
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <div className="shrink-0">
              <Donut
                value={stats.pct}
                color={color}
                size={compact ? 116 : 140}
                label={`${stats.pct}%`}
                sub="day done"
              />
              <p className="mt-2 text-center font-mono text-[10px] text-faint">
                {stats.finished}/{classes.length} classes ·{" "}
                {stats.remainingMin > 0 ? `${stats.remainingMin} min left` : "wrapped"}
              </p>
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <AnimatePresence initial={false}>
                {classes.map((s, i) => {
                  const p = pctOf(s, now);
                  const c = sessionColor(s, colorMap) ?? FALLBACK_COURSE_COLOR;
                  const isLive = live?.id === s.id;
                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.05, 0.3) }}
                      className={`rounded-xl px-3 py-2 ring-1 ${
                        isLive ? "bg-surface2 ring-cyan/40" : "ring-border"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`size-2 shrink-0 rounded-full ${isLive ? "pulse-dot" : ""}`}
                          style={{ backgroundColor: c }}
                        />
                        <span className="min-w-0 flex-1 truncate font-display text-[13px] font-semibold">
                          {shortSubject(sessionLabel(s), 26)}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-faint">
                          {clock.format(new Date(s.start_at))}–{clock.format(new Date(s.end_at))}
                        </span>
                      </div>
                      <SessionMeta session={s} max={4} />

                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${p}%` }}
                          transition={{ type: "spring", stiffness: 90, damping: 20 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: p === 100 ? "var(--evt-present)" : c }}
                        />
                      </div>
                      {isMember && user && (
                        <button
                          onClick={() => toggleAbsent.mutate(s)}
                          className={`mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1 font-mono text-[10px] ring-1 ${
                            myMarks.get(s.id) === "absent"
                              ? "bg-evt-exam/20 text-evt-exam ring-evt-exam/40"
                              : "text-dim ring-border hover:text-ink"
                          }`}
                        >
                          <CircleSlash className="size-3" />
                          {myMarks.get(s.id) === "absent" ? "Marked absent" : "Absent"}
                        </button>
                      )}

                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
          </>
        )}
      </div>
    </section>
  );
}

/** Between two classes — a playful, breathing "break in progress" banner. */
function BreakBanner({
  startsIn,
  nextLabel,
  nextAt,
  prevLabel,
  name,
}: {
  startsIn: number;
  nextLabel: string;
  nextAt: string;
  prevLabel: string | null;
  name?: string | null;
}) {
  const h = Math.floor(startsIn / 60);
  const m = startsIn % 60;
  const left = h > 0 ? `${h}h ${m}m` : `${m} min`;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 160, damping: 20 }}
      className="mb-4 overflow-hidden rounded-xl bg-surface2/70 px-4 py-3 ring-1 ring-amber/30"
    >
      <div className="flex items-center gap-3">
        <div className="relative grid size-9 shrink-0 place-items-center rounded-full bg-amber/12">
          <motion.span
            className="absolute inset-0 rounded-full ring-1 ring-amber/40"
            animate={{ scale: [1, 1.25, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
          />
          <motion.div
            animate={{ rotate: [-6, 6, -6] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Coffee className="size-4 text-amber" />
          </motion.div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-display text-[13px] font-semibold text-amber">
            Break time{name ? `, ${name}` : ""}
            <span className="flex items-end gap-0.5">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="block size-1 rounded-full bg-amber"
                  animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }}
                />
              ))}
            </span>
          </p>
          <p className="truncate font-mono text-[10px] text-dim">
            {prevLabel ? `${prevLabel} wrapped · ` : "Day not started · "}
            {nextLabel} at {nextAt} — {left} to go
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex gap-1 overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => (
          <motion.span
            key={i}
            className="h-1 flex-1 rounded-full bg-amber/25"
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.08 }}
          />
        ))}
      </div>
    </motion.div>
  );
}
