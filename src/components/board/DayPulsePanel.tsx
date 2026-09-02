import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { CircleSlash, Sun } from "lucide-react";
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
  const colorMap = useMemo(() => buildColorMap(courses), [courses]);

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
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${p}%` }}
                          transition={{ type: "spring", stiffness: 90, damping: 20 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: p === 100 ? "var(--evt-present)" : c }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
