import { Fragment, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CircleSlash, Clock3, Sun } from "lucide-react";
import { toast } from "sonner";
import { db as supabase } from "@/lib/backend";
import { useAuth } from "@/hooks/use-auth";
import { useBatch } from "@/hooks/use-batch";
import { useMe } from "@/hooks/use-me";
import { attendanceQuery, sessionsQuery, type ClassSession } from "@/lib/batches";
import {
  breakMap,
  buildColorMap,
  formatBreak,
  isAcademicEvent,
  isDayOff,
  isTeachingClass,
  sessionColor,
  sessionFullName,
  sessionMeta,
} from "@/lib/courses";

import { coursesQuery } from "@/lib/batches";
import { FALLBACK_COURSE_COLOR } from "@/lib/courses";
import { Donut } from "@/components/ui/donut";
import { dayKey } from "@/lib/deadlines";

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

  /** Same definition of "a class" as the timetable and attendance pages. */
  const classes = today.filter(isTeachingClass);
  const dayOff = isDayOff(new Date(now));
  /** Free stretches between classes read as break time on the timeline. */
  const breaks = useMemo(() => breakMap(classes), [classes]);



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
      finished: classes.filter((s) => new Date(s.end_at).getTime() <= now).length,
    };
  }, [classes, now]);

  const live = classes.find(
    (s) => now >= new Date(s.start_at).getTime() && now <= new Date(s.end_at).getTime(),
  );

  const nextClass = useMemo(() => {
    if (live) return null;
    return classes.find((s) => new Date(s.start_at).getTime() > now) ?? null;
  }, [classes, live, now]);

  const donutColor = stats.pct >= 100 ? "var(--evt-present)" : "var(--cyan)";

  return (
    <section className={compact ? "" : "mt-4"}>
      <div className="mb-3 flex items-center gap-2">
        <Sun className="size-3.5 text-amber" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber">
          {compact ? "Today" : `Today's pulse${me.name ? ` · ${me.name}` : ""}`}
        </p>
      </div>

      <div
        className={`overflow-hidden rounded-2xl ring-1 ${
          dayOff ? "bg-amber/8 ring-amber/20" : "bg-surface ring-border"
        }`}
      >
        {classes.length === 0 ? (
          <p className="py-8 text-center font-mono text-[11px] text-faint">
            {dayOff
              ? "Sunday off — no classes today."
              : today.some((s) => s.is_holiday)
                ? "Holiday — no classes today."
                : "No classes scheduled today."}
          </p>

        ) : (
          <>
            {/* ── Header strip: donut + status timer ─────────────────── */}
            <div className="relative flex items-center gap-5 border-b border-border/60 bg-surface2/40 px-5 py-4">
              <Donut
                value={stats.pct}
                color={donutColor}
                size={compact ? 92 : 108}
                label={`${stats.pct}%`}
                sub="day done"
              />
              <div className="min-w-0 flex-1">
                <AnimatePresence mode="wait">
                  <StatusBlock
                    key={live ? `live-${live.id}` : nextClass ? `next-${nextClass.id}` : "wrapped"}
                    live={live ?? null}
                    next={nextClass}
                    now={now}
                    colorMap={colorMap}
                  />
                </AnimatePresence>
                <div className="mt-3 flex items-center gap-4 font-mono text-[10px] text-faint">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 text-evt-present" />
                    {stats.finished}/{classes.length} classes done
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock3 className="size-3" />
                    {stats.remainingMin > 0 ? `${stats.remainingMin} min left` : "wrapped"}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Class timeline ─────────────────────────────────────── */}
            <ol className="relative space-y-0 px-5 py-3">
              {classes.map((s, i) => {
                const p = pctOf(s, now);
                const c = sessionColor(s, colorMap) ?? FALLBACK_COURSE_COLOR;
                const isLive = live?.id === s.id;
                const isDone = p === 100;
                const absent = myMarks.get(s.id) === "absent";
                const meta = sessionMeta(s);
                const gap = breaks.get(s.id);
                const gapLive = gap ? now >= gap.start && now < gap.end : false;
                return (
                  <Fragment key={s.id}>
                  {gap && (
                    <li
                      key={`break-${s.id}`}
                      className="relative flex gap-4 pb-3"
                      aria-label="Break time"
                    >
                      <span className="absolute left-[7px] top-0 h-full w-px bg-border/70" />
                      <span className="relative z-10 mt-3 size-[15px] shrink-0 rounded-full bg-surface2 ring-4 ring-surface" />
                      <div
                        className={`min-w-0 flex-1 rounded-xl border border-dashed px-3.5 py-2 ${
                          gapLive ? "border-amber/50 bg-amber/8" : "border-border/70"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p
                            className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
                              gapLive ? "text-amber" : "text-faint"
                            }`}
                          >
                            {formatBreak(gap.minutes)}
                          </p>
                          <span className="font-mono text-xs tabular-nums text-faint">
                            {clock.format(new Date(gap.start))}–{clock.format(new Date(gap.end))}
                          </span>
                        </div>
                      </div>
                    </li>
                  )}
                  <motion.li
                    key={s.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.06, 0.3) }}
                    className="relative flex gap-4 pb-3 last:pb-0"
                  >
                    {/* timeline spine */}
                    {i < classes.length - 1 && (
                      <span className="absolute left-[7px] top-7 h-full w-px bg-border/70" />
                    )}
                    <span
                      className={`relative z-10 mt-3 size-[15px] shrink-0 rounded-full ring-4 ring-surface ${
                        isLive ? "pulse-dot" : ""
                      }`}
                      style={{
                        backgroundColor: c,
                        opacity: isDone ? 0.45 : 1,
                      }}
                    />

                    <div
                      className={`min-w-0 flex-1 rounded-xl px-3.5 py-3 ring-1 transition-colors ${
                        isLive ? "bg-surface2 ring-cyan/40" : "ring-border/70"
                      } ${isDone && !isLive ? "opacity-70" : ""}`}
                    >
                      {/* row 1: name + time + absent */}
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 font-display text-[13.5px] font-semibold leading-snug">
                          {sessionFullName(s)}
                        </p>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-mono text-xs tabular-nums text-faint">
                            {clock.format(new Date(s.start_at))}–{clock.format(new Date(s.end_at))}
                          </span>
                          {isMember && user && (
                            <motion.button
                              whileTap={{ scale: 0.94 }}
                              onClick={() => toggleAbsent.mutate(s)}
                              title={absent ? "Clear absence" : "Mark absent"}
                              className={`flex size-6 items-center justify-center rounded-lg ring-1 transition-colors ${
                                absent
                                  ? "bg-evt-exam/20 text-evt-exam ring-evt-exam/40"
                                  : "text-dim ring-border hover:text-ink"
                              }`}
                            >
                              <CircleSlash className="size-3" />
                            </motion.button>
                          )}
                        </div>
                      </div>

                      {/* row 2: meta chips */}
                      {meta.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          {meta.map((m) => (
                            <span
                              key={m}
                              className="rounded-md px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide"
                              style={{
                                color: c,
                                backgroundColor: `color-mix(in oklab, ${c} 14%, transparent)`,
                                boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${c} 28%, transparent)`,
                              }}
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* row 3: progress bar */}
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface2">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${p}%` }}
                            transition={{ type: "spring", stiffness: 90, damping: 20 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: isDone ? "var(--evt-present)" : c }}
                          />
                        </div>
                        <span className="w-8 text-right font-mono text-[9px] tabular-nums text-faint">
                          {p}%
                        </span>
                      </div>
                    </div>
                  </motion.li>
                  </Fragment>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </section>
  );
}

function fmtLeft(ms: number) {
  const min = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

/** Status block beside the donut — live class, next class, or wrapped. */
function StatusBlock({
  live,
  next,
  now,
  colorMap,
}: {
  live: ClassSession | null;
  next: ClassSession | null;
  now: number;
  colorMap: Map<string, string>;
}) {
  const target = live ?? next;
  if (!target)
    return (
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        className="font-display text-lg font-semibold"
      >
        Day wrapped 🎉
      </motion.p>
    );

  const msLeft = live
    ? new Date(target.end_at).getTime() - now
    : new Date(target.start_at).getTime() - now;
  const c = sessionColor(target, colorMap) ?? FALLBACK_COURSE_COLOR;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 160, damping: 20 }}
      className="min-w-0"
    >
      <p
        className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em]"
        style={{ color: c }}
      >
        {live && (
          <span
            className="pulse-dot inline-block size-1.5 rounded-full"
            style={{ backgroundColor: c }}
          />
        )}
        {live ? "Now in class" : "Up next"}
      </p>
      <p className="mt-1 truncate font-display text-base font-semibold leading-snug">
        {sessionFullName(target)}
      </p>
      <p className="mt-0.5 font-mono text-sm tabular-nums text-dim">
        {live ? `${fmtLeft(msLeft)} left` : `starts in ${fmtLeft(msLeft)}`} ·{" "}
        {clock.format(new Date(target.start_at))}–{clock.format(new Date(target.end_at))}
      </p>
      {/* animated accent ticks */}
      <div className="mt-2.5 flex max-w-[220px] gap-0.5">
        {Array.from({ length: 14 }).map((_, i) => (
          <motion.span
            key={i}
            className="h-0.5 flex-1 rounded-full"
            style={{ backgroundColor: c }}
            animate={{ opacity: [0.15, 0.9, 0.15] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.09 }}
          />
        ))}
      </div>
    </motion.div>
  );
}
