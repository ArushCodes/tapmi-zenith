import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckSquare, CircleSlash, Plus, RefreshCw, Search, Settings2, Square, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { db as supabase } from "@/lib/backend";
import { useAuth } from "@/hooks/use-auth";
import { useBatch } from "@/hooks/use-batch";
import {
  attendanceQuery,
  coursesQuery,
  sessionsQuery,
  syncStateQuery,
  type ClassSession,
} from "@/lib/batches";

import {
  FALLBACK_COURSE_COLOR,
  HOLIDAY_KEY,
  autoColor,
  breakMap,
  formatBreak,
  buildColorMap,
  sessionLabel,
  sessionNumberOf,
  courseKey,
  isAcademicEvent,
  isDayOff,
  isTeachingClass,
  sessionColor,
  sessionKey,
} from "@/lib/courses";

import { Marker, shapeForDeadline } from "@/lib/shapes";
import {
  DEADLINE_TYPES,
  deadlinesQueryFor,
  eventMeta,
  formatDeadlineWhen,
  type Deadline,
  type DeadlineType,
  displayTitle,
} from "@/lib/deadlines";
import { saveIcsUrl, syncTimetableNow } from "@/lib/timetable.functions";
import { SessionMeta } from "@/components/common/SessionMeta";

const HOLIDAY_COLOR = "#10B981";



const dayFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "2-digit",
  month: "short",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });

export function TimetablePanel() {
  const { batchId, batch, canManage, isMember } = useBatch();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: sessions = [], isLoading } = useQuery(sessionsQuery(batchId));
  const { data: courses = [] } = useQuery(coursesQuery(batchId));
  const { data: syncState } = useQuery(syncStateQuery(batchId, canManage));
  const { data: marks = [] } = useQuery(attendanceQuery(batchId, isMember));

  /** Sessions this user has already self-marked absent. */
  const absentIds = useMemo(
    () =>
      new Set(
        marks
          .filter((m) => m.user_id === user?.id && m.mark_source === "self" && m.status === "absent")
          .map((m) => m.session_id),
      ),
    [marks, user?.id],
  );

  const markAbsent = useMutation({
    mutationFn: async ({ session, clear }: { session: ClassSession; clear: boolean }) => {
      if (clear) {
        const { error } = await supabase
          .from("attendance_marks")
          .delete()
          .eq("session_id", session.id)
          .eq("user_id", user!.id)
          .eq("mark_source", "self");
        if (error) throw error;
        return "cleared" as const;
      }
      const { error } = await supabase.from("attendance_marks").upsert(
        {
          session_id: session.id,
          batch_id: session.batch_id,
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
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["attendance", batchId] });
      toast.success(res === "cleared" ? "Attendance cleared" : "Marked absent");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<string[]>([]);
  const [types, setTypes] = useState<DeadlineType[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  /** Day drill-down: clicking a date switches to that day's agenda. */
  const [dayFocus, setDayFocus] = useState<string | null>(null);

  const { data: deadlines = [] } = useQuery(deadlinesQueryFor(batchId));

  const runSync = useServerFn(syncTimetableNow);
  const saveFeed = useServerFn(saveIcsUrl);

  const sync = useMutation({
    mutationFn: async () => runSync({ data: { batchId: batchId! } }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["class-sessions", batchId] });
      queryClient.invalidateQueries({ queryKey: ["sync-state", batchId] });
      if (res.ok) toast.success(`Timetable ${res.result}`);
      else toast.error(res.result);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const monthEnd = useMemo(
    () => new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1),
    [monthStart],
  );

  /** How many events of each type exist this month — drives greyed-out chips. */
  const typeCounts = useMemo(() => {
    const c = {} as Record<DeadlineType, number>;
    for (const d of deadlines) {
      const t = new Date(d.due_at);
      if (t < monthStart || t >= monthEnd) continue;
      c[d.type] = (c[d.type] ?? 0) + 1;
    }
    return c;
  }, [deadlines, monthStart, monthEnd]);

  const grouped = useMemo(() => {
    const map = new Map<string, { sessions: ClassSession[]; events: Deadline[] }>();
    const bucket = (k: string) => {
      const cur = map.get(k) ?? { sessions: [], events: [] };
      map.set(k, cur);
      return cur;
    };
    const subjFilter = selected.length > 0;
    const typeFilter = types.length > 0;
    for (const s of sessions) {
      if (s.notes === "academic-calendar") continue;
      // A pure event-type filter means the user asked for events only.
      if (typeFilter && !subjFilter) continue;
      const start = new Date(s.start_at);
      if (start < monthStart || start >= monthEnd) continue;
      if (subjFilter && !selected.includes(sessionKey(s))) continue;
      bucket(start.toDateString()).sessions.push(s);
    }
    for (const d of deadlines) {
      // A pure subject filter means the user asked for classes only.
      if (subjFilter && !typeFilter) continue;
      const start = new Date(d.due_at);
      if (start < monthStart || start >= monthEnd) continue;
      if (typeFilter && !types.includes(d.type)) continue;
      bucket(start.toDateString()).events.push(d);
    }

    for (const v of map.values()) {
      v.sessions.sort((a, b) => a.start_at.localeCompare(b.start_at));
      v.events.sort((a, b) => a.due_at.localeCompare(b.due_at));
    }
    return [...map.entries()].sort(
      ([a], [b]) => new Date(a).getTime() - new Date(b).getTime(),
    );
  }, [sessions, deadlines, monthStart, monthEnd, selected, types]);

  /** Every markable class currently on screen — the pool for mass actions.
   *  Only real classes count (no holidays, milestones or assessments). */
  const visibleSessions = useMemo(
    () =>
      grouped
        .flatMap(([day, v]) => (!dayFocus || day === dayFocus ? v.sessions : []))
        .filter(isTeachingClass),
    [grouped, dayFocus],
  );

  const pickedSet = useMemo(() => new Set(picked), [picked]);
  const togglePick = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const bulk = useMutation({
    mutationFn: async (action: "absent" | "clear") => {
      const ids = picked;
      if (ids.length === 0) return 0;
      if (action === "clear") {
        const { error } = await supabase
          .from("attendance_marks")
          .delete()
          .in("session_id", ids)
          .eq("user_id", user!.id)
          .eq("mark_source", "self");
        if (error) throw error;
        return ids.length;
      }
      const rows = visibleSessions
        .filter((s) => pickedSet.has(s.id))
        .map((s) => ({
          session_id: s.id,
          batch_id: s.batch_id,
          user_id: user!.id,
          status: "absent" as const,
          mark_source: "self" as const,
          marked_by: user!.id,
        }));
      const { error } = await supabase
        .from("attendance_marks")
        .upsert(rows, { onConflict: "session_id,user_id,mark_source" });
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n, action) => {
      queryClient.invalidateQueries({ queryKey: ["attendance", batchId] });
      setPicked([]);
      toast.success(action === "clear" ? `Cleared ${n} classes` : `Marked ${n} classes absent`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("class_sessions").delete().in("id", picked);
      if (error) throw error;
      return picked.length;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ["class-sessions", batchId] });
      setPicked([]);
      toast.success(`Deleted ${n} classes`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  /** Unique colour per subject in this batch, catalogued or feed-discovered. */
  const colorMap = useMemo(() => buildColorMap(courses, sessions), [courses, sessions]);

  /** Every class that appears anywhere in the feed, plus catalogued courses.
   *  All holidays collapse into a single "Holidays" filter. */
  const options = useMemo(() => {
    const m = new Map<
      string,
      { key: string; label: string; sub: string; color: string; count: number }
    >();
    for (const c of courses) {
      m.set(courseKey(c), {
        key: courseKey(c),
        label: c.short_name || c.code,
        sub: [c.code, c.faculty_name].filter(Boolean).join(" · "),
        color: colorMap.get(courseKey(c)) ?? c.color ?? FALLBACK_COURSE_COLOR,
        count: 0,
      });
    }
    for (const s of sessions) {
      if (isAcademicEvent(s)) continue;
      const key = sessionKey(s);
      const existing = m.get(key);
      if (existing) {
        existing.count += 1;
        continue;
      }
      m.set(key, {
        key,
        label: key === HOLIDAY_KEY ? "Holidays" : sessionLabel(s),
        sub: key === HOLIDAY_KEY ? "No classes scheduled" : [s.course_code, s.faculty_name].filter(Boolean).join(" · "),
        color: key === HOLIDAY_KEY ? HOLIDAY_COLOR : (colorMap.get(key) ?? autoColor(key)),
        count: 1,
      });
    }
    return [...m.values()].sort((a, b) => {
      if (a.key === HOLIDAY_KEY) return 1;
      if (b.key === HOLIDAY_KEY) return -1;
      return a.label.localeCompare(b.label);
    });
  }, [courses, sessions, colorMap]);

  const colorOf = (s: ClassSession) => sessionColor(s, colorMap);


  return (
    <section className="mt-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          aria-label="Previous month"
          onClick={() =>
            setMonthStart((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
          }
          className="rounded-lg bg-surface2 px-3 py-1.5 font-mono text-[11px] text-dim ring-1 ring-border hover:text-ink"
        >
          ←
        </button>
        <span className="min-w-[9.5rem] text-center font-display text-sm font-semibold tracking-tight">
          {monthFmt.format(monthStart)}
        </span>
        <button
          aria-label="Next month"
          onClick={() =>
            setMonthStart((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
          }
          className="rounded-lg bg-surface2 px-3 py-1.5 font-mono text-[11px] text-dim ring-1 ring-border hover:text-ink"
        >
          →
        </button>
        <button
          onClick={() => {
            setMonthStart(startOfMonth(new Date()));
            setDayFocus(null);
          }}
          className="rounded-lg bg-surface2 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-dim ring-1 ring-border hover:text-ink"
        >
          Today
        </button>

        <div className="ml-auto flex items-center gap-2">
          {(isMember || canManage) && (
            <button
              onClick={() => setShowCustom((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg bg-surface2 px-2.5 py-1.5 font-mono text-[11px] text-dim ring-1 ring-border hover:text-ink"
            >
              <Plus className="size-3.5" /> Custom class
            </button>
          )}
          {canManage && (
            <>
              <button
                onClick={() => setShowSettings((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg bg-surface2 px-2.5 py-1.5 font-mono text-[11px] text-dim ring-1 ring-border hover:text-ink"
              >
                <Settings2 className="size-3.5" /> Calendar link
              </button>
              <button
                onClick={() => sync.mutate()}
                disabled={sync.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-cyan px-3 py-1.5 text-sm font-semibold text-ground disabled:opacity-60"
              >
                <RefreshCw className={`size-3.5 ${sync.isPending ? "animate-spin" : ""}`} /> Sync
              </button>
            </>
          )}
        </div>
      </div>

      {canManage && syncState && (
        <p className="mb-3 font-mono text-[10px] text-faint">
          {syncState.paused
            ? "Sync paused after repeated failures — fix the credentials and sync manually."
            : syncState.last_success_at
              ? `Last synced ${new Date(syncState.last_success_at).toLocaleString("en-GB")} · ${syncState.last_count ?? 0} sessions`
              : "Never synced yet."}
          {syncState.last_error ? ` · ${syncState.last_error}` : ""}
        </p>
      )}

      <AnimatePresence initial={false}>
        {showSettings && canManage && (
          <IcsSettings
            current={batch?.ics_url ?? ""}
            onSave={async (icsUrl) => {
              await saveFeed({ data: { batchId: batchId!, icsUrl } });
              toast.success("Calendar link saved — syncing now");
              setShowSettings(false);
              sync.mutate();
            }}
          />
        )}
        {showCustom && (isMember || canManage) && (
          <CustomClassForm
            batchId={batchId!}
            canManage={canManage}
            userId={user?.id ?? null}
            onDone={() => {
              setShowCustom(false);
              queryClient.invalidateQueries({ queryKey: ["class-sessions", batchId] });
            }}
          />
        )}
      </AnimatePresence>

      <CourseCatalogue
        options={options}
        selected={selected}
        onToggle={(code) =>
          setSelected((prev) =>
            prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
          )
        }
        onSelectAll={() => setSelected(options.map((o) => o.key))}
        onClear={() => setSelected([])}
      />

      <div className="mb-5 rounded-xl bg-surface p-4 ring-1 ring-border">
        <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
          <span>Events this month</span>
          <span className="h-px flex-1 bg-border" />
          <button
            onClick={() => setTypes([])}
            disabled={types.length === 0}
            className="text-faint normal-case hover:text-ink disabled:opacity-40"
          >
            Reset
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEADLINE_TYPES.map((t) => {
            const n = typeCounts[t.value] ?? 0;
            const meta = eventMeta(t.value);
            const on = types.includes(t.value);
            return (
              <motion.button
                key={t.value}
                whileHover={n ? { y: -2 } : {}}
                whileTap={n ? { scale: 0.96 } : {}}
                disabled={n === 0}
                onClick={() =>
                  setTypes((p) =>
                    p.includes(t.value) ? p.filter((x) => x !== t.value) : [...p, t.value],
                  )
                }
                title={n === 0 ? `No ${t.label.toLowerCase()} this month` : `${n} scheduled`}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[10px] outline-none transition-all focus:outline-none focus-visible:outline-none ${
                  n === 0
                    ? "cursor-not-allowed bg-surface2 text-faint opacity-50 ring-1 ring-border"
                    : `${meta.chip} ${on ? "ring-2" : ""}`
                }`}
              >
                <Marker
                  shape={shapeForDeadline(t.value)}
                  color={n === 0 ? "#64748B" : "currentColor"}
                  size={8}
                />
                {t.label}
                <span className="opacity-70">{n}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {(isMember || canManage) && visibleSessions.length > 0 && (
          <motion.div
            layout
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={`mb-4 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 ring-1 ring-border ${
              picked.length > 0
                ? "sticky top-20 z-40 bg-surface2/95 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.6)] backdrop-blur"
                : "bg-surface2"
            }`}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
              {picked.length > 0 ? `${picked.length} selected` : "Multi-select"}
            </span>
            <button
              onClick={() => setPicked(visibleSessions.map((s) => s.id))}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[10px] text-dim ring-1 ring-border hover:text-ink"
            >
              <CheckSquare className="size-3.5" /> Select all ({visibleSessions.length})
            </button>
            <button
              onClick={() => setPicked([])}
              disabled={picked.length === 0}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[10px] text-dim ring-1 ring-border hover:text-ink disabled:opacity-40"
            >
              <X className="size-3.5" /> Clear selection
            </button>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {isMember && user && (
                <>
                  <button
                    onClick={() => bulk.mutate("absent")}
                    disabled={picked.length === 0 || bulk.isPending}
                    className="flex items-center gap-1.5 rounded-lg bg-evt-exam/15 px-2.5 py-1.5 font-mono text-[10px] text-evt-exam ring-1 ring-evt-exam/40 disabled:opacity-40"
                  >
                    <CircleSlash className="size-3.5" /> Mark absent
                  </button>
                  <button
                    onClick={() => bulk.mutate("clear")}
                    disabled={picked.length === 0 || bulk.isPending}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[10px] text-dim ring-1 ring-border hover:text-ink disabled:opacity-40"
                  >
                    <Check className="size-3.5" /> Clear marks
                  </button>
                </>
              )}
              {canManage && (
                <button
                  onClick={() => bulkDelete.mutate()}
                  disabled={picked.length === 0 || bulkDelete.isPending}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[10px] text-evt-exam ring-1 ring-evt-exam/30 hover:bg-evt-exam/10 disabled:opacity-40"
                >
                  <Trash2 className="size-3.5" /> Delete classes
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {isLoading ? (
        <p className="mt-6 text-center font-mono text-xs text-faint">Loading timetable…</p>
      ) : grouped.length === 0 ? (
        <p className="mt-8 text-center font-mono text-xs text-faint">
          No classes this month. {canManage ? "Paste a calendar link and sync, or add a custom class." : ""}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <AnimatePresence initial={false}>
            {dayFocus && (
              <motion.button
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                onClick={() => setDayFocus(null)}
                className="self-start rounded-lg bg-surface2 px-3 py-1.5 font-mono text-[11px] text-cyan ring-1 ring-cyan/30"
              >
                ← Back to the whole month
              </motion.button>
            )}
          </AnimatePresence>

          {grouped
            .filter(([day]) => !dayFocus || day === dayFocus)
            .map(([day, list]) => {
              const dayMarkable = list.sessions.filter((s) => !s.is_holiday);
              const dayBreaks = breakMap(list.sessions.filter(isTeachingClass));
              const allPicked =
                dayMarkable.length > 0 && dayMarkable.every((s) => pickedSet.has(s.id));
              const total = list.sessions.length + list.events.length;
              return (
              <motion.div
                key={day}
                layout
                className={
                  isDayOff(day)
                    ? "rounded-2xl bg-amber/8 p-3 ring-1 ring-amber/20"
                    : undefined
                }
              >
                <div className="mb-2 flex items-center gap-3">
                  <button
                    onClick={() => setDayFocus((d) => (d === day ? null : day))}
                    className={`flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] transition-colors hover:text-ink ${
                      isDayOff(day) ? "text-amber" : "text-cyan"
                    }`}
                  >
                    {dayFmt.format(new Date(day))}
                    {isDayOff(day) && (
                      <span className="normal-case tracking-normal text-amber">· Sunday off</span>
                    )}
                    <span className="normal-case tracking-normal text-faint">
                      {dayFocus === day ? "· agenda" : `· ${total} entr${total === 1 ? "y" : "ies"}`}
                    </span>
                  </button>
                  {dayMarkable.length > 0 && (isMember || canManage) && (
                    <button
                      onClick={() =>
                        setPicked((p) =>
                          allPicked
                            ? p.filter((id) => !dayMarkable.some((s) => s.id === id))
                            : [...new Set([...p, ...dayMarkable.map((s) => s.id)])],
                        )
                      }
                      className="font-mono text-[10px] text-faint hover:text-ink"
                    >
                      {allPicked ? "Unselect day" : "Select day"}
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {list.sessions.map((s) => {
                    const color = s.is_holiday ? HOLIDAY_COLOR : colorOf(s);
                    const isPicked = pickedSet.has(s.id);
                    const gap = dayBreaks.get(s.id);
                    return (
                      <Fragment key={s.id}>
                      {gap && (
                        <div className="flex items-center gap-3 rounded-xl border border-dashed border-border/70 px-3 py-1.5">
                          <span className="font-mono text-[11px] tabular-nums text-faint">
                            {timeFmt.format(new Date(gap.start))}–{timeFmt.format(new Date(gap.end))}
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                            {formatBreak(gap.minutes)}
                          </span>
                        </div>
                      )}
                      <motion.div
                        layout
                        whileHover={{ scale: 1.01, y: -2 }}
                        style={{ borderLeftColor: color ?? "transparent" }}
                        className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border-l-[3px] bg-surface px-3 py-3 ring-1 transition-shadow hover:shadow-lg hover:shadow-black/30 ${
                          isPicked
                            ? "ring-cyan/50"
                            : s.is_holiday
                              ? "ring-evt-present/30"
                              : "ring-border"
                        }`}
                      >
                        {isTeachingClass(s) && (isMember || canManage) ? (
                          <button
                            onClick={() => togglePick(s.id)}
                            title="Select for mass actions"
                            className={`shrink-0 transition-colors ${isPicked ? "text-cyan" : "text-faint hover:text-ink"}`}
                          >
                            {isPicked ? (
                              <CheckSquare className="size-4" />
                            ) : (
                              <Square className="size-4" />
                            )}
                          </button>
                        ) : null}
                        <Marker
                          shape={s.is_holiday ? "bar" : "circle"}
                          color={color ?? FALLBACK_COURSE_COLOR}
                          size={9}
                        />
                        <span className="font-mono text-[11px] text-dim">
                          {s.is_holiday
                            ? "All day"
                            : `${timeFmt.format(new Date(s.start_at))}–${timeFmt.format(new Date(s.end_at))}`}
                        </span>
                        <span className="min-w-0 flex-1 basis-full sm:basis-auto">
                          <span className="block truncate font-display text-sm font-semibold">
                            {sessionLabel(s)}
                          </span>
                          <SessionMeta session={s} />

                        </span>
                        {s.course_code && (
                          <span
                            className="shrink-0 rounded-md px-2 py-1 font-mono text-[10px]"
                            style={{
                              color: color ?? undefined,
                              backgroundColor: color ? `${color}1a` : undefined,
                            }}
                          >
                            {s.course_code}
                          </span>
                        )}
                        {isTeachingClass(s) && isMember && user && (
                          <motion.button
                            whileTap={{ scale: 0.94 }}
                            onClick={() =>
                              markAbsent.mutate({
                                session: s,
                                clear: absentIds.has(s.id),
                              })
                            }
                            title={
                              absentIds.has(s.id) ? "Tap again to clear" : "Mark yourself absent"
                            }
                            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[10px] ring-1 transition-colors ${
                              absentIds.has(s.id)
                                ? "bg-evt-exam/20 text-evt-exam ring-evt-exam/40"
                                : "text-dim ring-border hover:text-ink"
                            }`}
                          >
                            <CircleSlash className="size-3.5" />
                            {absentIds.has(s.id) ? "Absent" : "Mark absent"}
                          </motion.button>
                        )}

                      </motion.div>
                      </Fragment>
                    );
                  })}

                  {list.events.map((d) => {
                    const meta = eventMeta(d.type);
                    return (
                      <motion.div
                        key={d.id}
                        layout
                        whileHover={{ scale: 1.01, y: -2 }}
                        className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-surface px-3 py-2.5 ring-1 ${meta.ring}`}
                      >
                        <Marker shape={shapeForDeadline(d.type)} color="currentColor" size={9} />
                        <span className="font-mono text-[11px] text-dim">
                          {formatDeadlineWhen(d)}
                        </span>
                        <span className="min-w-0 flex-1 basis-full truncate font-display text-sm font-semibold sm:basis-auto">
                          {displayTitle(d.subject, d.title)}
                        </span>
                        <span className={`shrink-0 rounded-md px-2 py-1 font-mono text-[10px] ${meta.chip}`}>
                          {meta.label}
                          {d.subject ? ` · ${d.subject}` : ""}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
              );
            })}

        </div>
      )}


    </section>
  );
}

type CourseOption = {
  key: string;
  label: string;
  sub: string;
  color: string;
  count: number;
};

function CourseCatalogue({
  options,
  selected,
  onToggle,
  onSelectAll,
  onClear,
}: {
  options: CourseOption[];
  selected: string[];
  onToggle: (code: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  if (options.length === 0) return null;

  const query = q.trim().toLowerCase();
  const shown = query
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query) || o.sub.toLowerCase().includes(query),
      )
    : options;

  return (
    <div className="mb-5 rounded-xl bg-surface p-4 ring-1 ring-border">
      <div className="flex w-full flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
        <span>
          Classes · {options.length}
          {selected.length > 0 ? ` · ${selected.length} selected` : ""}
        </span>
        <span className="h-px flex-1 bg-border" />
        <button onClick={onSelectAll} className="text-faint normal-case hover:text-ink">
          Select all
        </button>
        <button
          onClick={onClear}
          disabled={selected.length === 0}
          className="text-faint normal-case hover:text-ink disabled:opacity-40"
        >
          Deselect all
        </button>
        <button onClick={() => setOpen((v) => !v)} className="text-faint hover:text-ink">
          {open ? "Hide" : "Details"}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Search className="size-3.5 shrink-0 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a class, code or faculty…"
          className="w-full rounded-lg bg-surface2 px-3 py-1.5 font-mono text-[11px] ring-1 ring-border outline-none focus:ring-cyan/40"
        />
      </div>

      <p className="mt-2 font-mono text-[10px] normal-case text-faint">
        No selection = every class shown. Tap to add a class, tap again to deselect it.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {shown.map((o) => {
          const isOn = selected.includes(o.key);
          const dimmed = selected.length > 0 && !isOn;
          return (
            <motion.button
              key={o.key}
              layout
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onToggle(o.key)}
              title={o.sub || o.label}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[10px] outline-none transition-opacity focus:outline-none focus-visible:outline-none ${
                dimmed ? "opacity-40" : "opacity-100"
              }`}
              style={{
                color: o.color,
                backgroundColor: `${o.color}1a`,
                boxShadow: isOn ? `0 0 0 1px ${o.color}` : "none",
              }}
            >
              {isOn ? (
                <Check className="size-3" />
              ) : (
                <Marker shape={o.key === HOLIDAY_KEY ? "bar" : "circle"} color={o.color} size={8} />
              )}
              {o.label}
              {o.count > 0 && <span className="text-[9px] opacity-70">{o.count}</span>}
            </motion.button>
          );
        })}
        {shown.length === 0 && (
          <p className="font-mono text-[10px] text-faint">No class matches “{q}”.</p>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {shown.map((o) => (
                <button
                  key={o.key}
                  onClick={() => onToggle(o.key)}
                  className={`rounded-lg border-l-[3px] bg-surface2 px-3 py-2 text-left transition-opacity hover:bg-surface ${
                    selected.length > 0 && !selected.includes(o.key) ? "opacity-50" : ""
                  }`}
                  style={{ borderLeftColor: o.color }}
                >
                  <p className="truncate font-display text-sm font-semibold">{o.label}</p>
                  <p className="truncate font-mono text-[11px] text-dim">
                    {o.sub || "—"}
                    {o.count > 0 ? ` · ${o.count} sessions` : ""}
                  </p>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

}

function IcsSettings({
  onSave,
  current,
}: {
  onSave: (icsUrl: string) => Promise<void>;
  current: string;
}) {
  const [url, setUrl] = useState(current);
  const [busy, setBusy] = useState(false);

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSave(url.trim());
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not save");
        } finally {
          setBusy(false);
        }
      }}
      className="mb-5 overflow-hidden rounded-xl bg-surface p-4 ring-1 ring-border"
    >
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
        Timetable calendar link (.ics)
      </p>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.github.io/tt-sync/timetable.ics"
        required
        type="url"
        className="w-full rounded-lg bg-surface2 px-3 py-2 text-sm ring-1 ring-border outline-none focus:ring-cyan/40"
      />
      <p className="mt-2 font-mono text-[10px] text-faint">
        Any public .ics feed works — classes, faculty, rooms and holidays are imported automatically
        and each course gets its own colour.
      </p>
      <button
        type="submit"
        disabled={busy}
        className="mt-3 rounded-lg bg-cyan px-3 py-1.5 text-sm font-semibold text-ground disabled:opacity-60"
      >
        Save & sync
      </button>
    </motion.form>
  );
}

function CustomClassForm({
  batchId,
  canManage,
  userId,
  onDone,
}: {
  batchId: string;
  canManage: boolean;
  userId: string | null;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [room, setRoom] = useState("");
  const [scope, setScope] = useState<"batch" | "private">(canManage ? "batch" : "private");
  const [busy, setBusy] = useState(false);

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { error } = await supabase.from("class_sessions").insert({
          batch_id: batchId,
          source: "custom",
          title,
          start_at: new Date(start).toISOString(),
          end_at: new Date(end).toISOString(),
          classroom: room || null,
          visibility: canManage ? scope : "private",
          created_by: userId,
        });
        setBusy(false);
        if (error) toast.error(error.message);
        else {
          toast.success(
            (canManage ? scope : "private") === "batch"
              ? "Class added for the whole batch"
              : "Class added — only you can see it",
          );
          onDone();
        }
      }}
      className="mb-5 overflow-hidden rounded-xl bg-surface p-4 ring-1 ring-border"
    >
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
        Add a class the calendar feed does not have
      </p>
      {canManage ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {(
            [
              { key: "batch", label: "Everyone in this batch" },
              { key: "private", label: "Only me" },
            ] as const
          ).map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setScope(o.key)}
              className={`rounded-lg px-3 py-1.5 font-mono text-[11px] outline-none transition-colors focus:outline-none ${
                scope === o.key
                  ? "bg-cyan/15 text-cyan ring-1 ring-cyan/40"
                  : "bg-surface2 text-dim ring-1 ring-border hover:text-ink"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="mb-3 font-mono text-[10px] text-faint">
          Personal class — only you will see it.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          required
          className="rounded-lg bg-surface2 px-3 py-2 text-sm ring-1 ring-border outline-none focus:ring-cyan/40"
        />
        <input
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          required
          className="rounded-lg bg-surface2 px-3 py-2 text-sm ring-1 ring-border outline-none focus:ring-cyan/40"
        />
        <input
          type="datetime-local"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          required
          className="rounded-lg bg-surface2 px-3 py-2 text-sm ring-1 ring-border outline-none focus:ring-cyan/40"
        />
        <input
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="Room (optional)"
          className="rounded-lg bg-surface2 px-3 py-2 text-sm ring-1 ring-border outline-none focus:ring-cyan/40"
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="mt-3 rounded-lg bg-cyan px-3 py-1.5 text-sm font-semibold text-ground disabled:opacity-60"
      >
        Add class
      </button>
    </motion.form>
  );
}
