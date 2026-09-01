import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, ListOrdered } from "lucide-react";
import { dayKey, eventMeta, urgencyOf, type Deadline } from "@/lib/deadlines";
import type { ClassSession, Course } from "@/lib/batches";
import { Marker, SHAPE_LABEL, shapeForDeadline, type MarkerShape } from "@/lib/shapes";
import {
  FALLBACK_COURSE_COLOR,
  buildColorMap,
  courseKey,
  isAcademicEvent,
  sessionColor,
  sessionKey,
} from "@/lib/courses";

type SubView = "month" | "week" | "agenda";

const SUB_VIEWS: { key: SubView; label: string; icon: React.ReactNode }[] = [
  { key: "month", label: "Month", icon: <LayoutGrid className="size-3.5" /> },
  { key: "week", label: "Week", icon: <CalendarDays className="size-3.5" /> },
  { key: "agenda", label: "Agenda", icon: <ListOrdered className="size-3.5" /> },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const rangeFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
const agendaFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "2-digit",
  month: "short",
});

type Props = {
  deadlines: Deadline[];
  sessions?: ClassSession[];
  courses?: Course[];
  now: number;
  onSelect: (d: Deadline) => void;
};

export function CalendarPanel({ deadlines, sessions = [], courses = [], now, onSelect }: Props) {
  const [subView, setSubView] = useState<SubView>("month");
  /** Clicking a date drills into that single day's agenda. */
  const [focusDay, setFocusDay] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => new Date());
  const [direction, setDirection] = useState(1);
  const [activeSubjects, setActiveSubjects] = useState<string[]>([]);
  const [showClasses, setShowClasses] = useState(true);

  const colorMap = useMemo(() => buildColorMap(courses), [courses]);

  const classSessions = useMemo(
    () => sessions.filter((s) => !isAcademicEvent(s)),
    [sessions],
  );
  const academic = useMemo(() => sessions.filter(isAcademicEvent), [sessions]);

  const visibleClasses = useMemo(() => {
    if (!showClasses) return [];
    if (activeSubjects.length === 0) return classSessions;
    return classSessions.filter((s) => activeSubjects.includes(sessionKey(s)));
  }, [classSessions, activeSubjects, showClasses]);

  const byDay = useMemo(() => {
    const map = new Map<string, Deadline[]>();
    for (const d of deadlines) {
      const k = dayKey(d.due_at);
      map.set(k, [...(map.get(k) ?? []), d]);
    }
    for (const list of map.values())
      list.sort((a, b) => a.due_at.localeCompare(b.due_at));
    return map;
  }, [deadlines]);

  const classesByDay = useMemo(() => {
    const map = new Map<string, ClassSession[]>();
    for (const s of visibleClasses) {
      const k = dayKey(s.start_at);
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    for (const list of map.values())
      list.sort((a, b) => a.start_at.localeCompare(b.start_at));
    return map;
  }, [visibleClasses]);

  /** Academic entries can span several days — expand across their range. */
  const academicByDay = useMemo(() => {
    const map = new Map<string, ClassSession[]>();
    for (const e of academic) {
      let d = new Date(e.start_at);
      d.setHours(12, 0, 0, 0);
      const end = new Date(e.end_at);
      for (let i = 0; i < 60 && d <= end; i++) {
        const k = dayKey(d);
        map.set(k, [...(map.get(k) ?? []), e]);
        d = addDays(d, 1);
      }
    }
    return map;
  }, [academic]);

  function shift(delta: number) {
    setDirection(delta);
    setCursor((c) => {
      const next = new Date(c);
      if (subView === "week") next.setDate(c.getDate() + delta * 7);
      else next.setMonth(c.getMonth() + delta, 1);
      return next;
    });
  }

  const weekStart = startOfWeek(cursor);
  const heading =
    subView === "week"
      ? `${rangeFmt.format(weekStart)} — ${rangeFmt.format(addDays(weekStart, 6))}`
      : monthFmt.format(cursor);

  const periodKey = `${subView}-${subView === "week" ? weekStart.toISOString() : `${cursor.getFullYear()}-${cursor.getMonth()}`}`;

  return (
    <section className="mt-4">
      <SubjectLegend
        courses={courses}
        active={activeSubjects}
        onToggle={(key) =>
          setActiveSubjects((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
          )
        }
        onClear={() => setActiveSubjects([])}
        showClasses={showClasses}
        onToggleClasses={() => setShowClasses((v) => !v)}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <NavButton label="Previous" onClick={() => shift(-1)}>
            <ChevronLeft className="size-4" />
          </NavButton>
          <NavButton label="Next" onClick={() => shift(1)}>
            <ChevronRight className="size-4" />
          </NavButton>
          <button
            onClick={() => {
              setDirection(1);
              setCursor(new Date());
            }}
            className="ml-1 rounded-lg bg-surface2 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-dim ring-1 ring-border transition-colors hover:text-ink hover:ring-cyan/40"
          >
            Today
          </button>
        </div>

        <h2 className="font-display text-lg font-semibold tracking-tight">{heading}</h2>

        <div className="ml-auto flex rounded-lg bg-surface2/70 p-0.5 ring-1 ring-border">
          {SUB_VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => {
                setSubView(v.key);
                if (v.key !== "agenda") setFocusDay(null);
              }}
              className={
                subView === v.key
                  ? "flex items-center gap-1.5 rounded-md bg-surface px-2.5 py-1 font-mono text-[11px] text-ink"
                  : "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] text-dim hover:text-ink"
              }
            >
              {v.icon}
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={periodKey}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {subView === "month" && (
              <MonthGrid
                onPickDay={(k) => {
                  setFocusDay(k);
                  setSubView("agenda");
                }}
                cursor={cursor}
                byDay={byDay}
                classesByDay={classesByDay}
                academicByDay={academicByDay}
                colorMap={colorMap}
                now={now}
                onSelect={onSelect}
              />
            )}
            {subView === "week" && (
              <WeekTimeline
                onPickDay={(k) => {
                  setFocusDay(k);
                  setSubView("agenda");
                }}
                weekStart={weekStart}
                byDay={byDay}
                classesByDay={classesByDay}
                academicByDay={academicByDay}
                colorMap={colorMap}
                now={now}
                onSelect={onSelect}
              />
            )}
            {subView === "agenda" && (
              <Agenda
                focusDay={focusDay}
                onClearFocus={() => setFocusDay(null)}
                cursor={cursor}
                deadlines={deadlines}
                classes={visibleClasses}
                academic={academic}
                colorMap={colorMap}
                now={now}
                onSelect={onSelect}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <Legend />
    </section>
  );
}

function SubjectLegend({
  courses,
  active,
  onToggle,
  onClear,
  showClasses,
  onToggleClasses,
}: {
  courses: Course[];
  active: string[];
  onToggle: (key: string) => void;
  onClear: () => void;
  showClasses: boolean;
  onToggleClasses: () => void;
}) {
  if (courses.length === 0) return null;
  return (
    <div className="mb-5 rounded-2xl bg-surface/60 p-4 ring-1 ring-border">
      <div className="mb-3 flex items-center gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">Subjects</p>
        <span className="h-px flex-1 bg-border" />
        <button
          onClick={onToggleClasses}
          className={`rounded-lg px-2.5 py-1 font-mono text-[10px] ring-1 transition-colors ${
            showClasses ? "text-cyan ring-cyan/30" : "text-faint ring-border"
          }`}
        >
          {showClasses ? "Classes on" : "Classes off"}
        </button>
        {active.length > 0 && (
          <button
            onClick={onClear}
            className="rounded-lg px-2.5 py-1 font-mono text-[10px] text-dim ring-1 ring-border hover:text-ink"
          >
            Clear filter
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {courses.map((c) => {
          const key = courseKey(c);
          const on = active.length === 0 || active.includes(key);
          const color = c.color ?? FALLBACK_COURSE_COLOR;
          return (
            <motion.button
              key={c.id}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onToggle(key)}
              title={[c.name, c.faculty_name].filter(Boolean).join(" · ")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[10px] ring-1 transition-opacity ${
                on ? "opacity-100" : "opacity-40"
              }`}
              style={{
                color,
                backgroundColor: `${color}14`,
                borderColor: color,
                boxShadow: active.includes(key) ? `0 0 0 1px ${color}` : undefined,
              }}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
              {c.short_name}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function NavButton({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="rounded-lg bg-surface2 p-1.5 text-dim ring-1 ring-border transition-colors hover:text-ink hover:ring-cyan/40"
    >
      {children}
    </button>
  );
}

function EventPill({
  deadline,
  now,
  onSelect,
  showTime = false,
}: {
  deadline: Deadline;
  now: number;
  onSelect: (d: Deadline) => void;
  showTime?: boolean;
}) {
  const m = eventMeta(deadline.type);
  const critical = urgencyOf(deadline.due_at, now) === "critical";
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onSelect(deadline)}
      className={`flex w-full items-center gap-1.5 overflow-hidden rounded-md px-1.5 py-1 text-left font-mono text-[10px] ${m.chip} ${critical ? m.glow : ""}`}
    >
      <Marker
        shape={shapeForDeadline(deadline.type)}
        size={9}
        className={`${m.dot} ${critical && deadline.is_major ? "pulse-dot" : ""}`}
      />
      {showTime && <span className="shrink-0 opacity-80">{timeFmt.format(new Date(deadline.due_at))}</span>}
      <span className="truncate">{deadline.subject_code ?? deadline.subject}</span>
    </motion.button>
  );
}

function ClassDots({
  list,
  colorMap,
}: {
  list: ClassSession[];
  colorMap: Map<string, string>;
}) {
  if (list.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {list.slice(0, 8).map((s) => (
        <span
          key={s.id}
          title={`${timeFmt.format(new Date(s.start_at))} · ${s.short_name ?? s.title}${s.faculty_name ? ` · ${s.faculty_name}` : ""}${s.classroom ? ` · ${s.classroom}` : ""}`}
          className="size-2 rounded-full ring-1 ring-black/30"
          style={{ backgroundColor: sessionColor(s, colorMap) ?? FALLBACK_COURSE_COLOR }}
        />
      ))}
    </div>
  );
}

function AcademicChip({ entry, dense = false }: { entry: ClassSession; dense?: boolean }) {
  return (
    <span
      title={entry.title}
      className={`flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 font-mono ${dense ? "text-[9px]" : "text-[10px]"} ${
        entry.is_holiday
          ? "bg-evt-present/15 text-evt-present"
          : "bg-cyan/12 text-cyan"
      }`}
    >
      <Marker shape="bar" size={7} className={entry.is_holiday ? "bg-evt-present" : "bg-cyan"} />
      <span className="truncate">{entry.title}</span>
    </span>
  );
}

function MonthGrid({
  onPickDay,
  cursor,
  byDay,
  classesByDay,
  academicByDay,
  colorMap,
  now,
  onSelect,
}: {
  onPickDay: (dayKey: string) => void;
  cursor: Date;
  byDay: Map<string, Deadline[]>;
  classesByDay: Map<string, ClassSession[]>;
  academicByDay: Map<string, ClassSession[]>;
  colorMap: Map<string, string>;
  now: number;
  onSelect: (d: Deadline) => void;
}) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const todayKey = dayKey(new Date(now));

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 pb-1">
        {WEEKDAYS.map((w) => (
          <span
            key={w}
            className="text-center font-mono text-[10px] uppercase tracking-[0.18em] text-faint"
          >
            {w.slice(0, 1)}
            <span className="hidden sm:inline">{w.slice(1)}</span>
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date) => {
          const k = dayKey(date);
          const events = byDay.get(k) ?? [];
          const classes = classesByDay.get(k) ?? [];
          const acad = academicByDay.get(k) ?? [];
          const inMonth = date.getMonth() === cursor.getMonth();
          const isToday = k === todayKey;
          return (
            <motion.div
              key={k}
              role="button"
              tabIndex={0}
              onClick={() => onPickDay(k)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onPickDay(k);
              }}
              whileHover={{ scale: 1.02, y: -2 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className={`min-h-[74px] cursor-pointer rounded-lg p-1.5 text-left ring-1 transition-shadow sm:min-h-[118px] ${
                inMonth ? "bg-surface ring-border" : "bg-surface/40 ring-transparent"
              } ${isToday ? "ring-cyan/50" : ""} hover:shadow-lg hover:shadow-black/30`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`font-mono text-[11px] ${
                    isToday ? "text-cyan" : inMonth ? "text-dim" : "text-faint"
                  }`}
                >
                  {date.getDate()}
                </span>
                {classes.length > 0 && (
                  <span className="font-mono text-[9px] text-faint">{classes.length}c</span>
                )}
              </div>

              {acad.length > 0 && (
                <div className="mt-1 flex flex-col gap-0.5">
                  {acad.slice(0, 2).map((e) => (
                    <AcademicChip key={e.id} entry={e} dense />
                  ))}
                </div>
              )}

              <ClassDots list={classes} colorMap={colorMap} />

              <div className="mt-1 flex flex-col gap-1">
                {events.slice(0, 2).map((d) => (
                  <EventPill key={d.id} deadline={d} now={now} onSelect={onSelect} />
                ))}
                {events.length > 2 && (
                  <span className="pl-1 font-mono text-[9px] text-faint">
                    +{events.length - 2} more
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8); // 08:00 → 22:00

function WeekTimeline({
  onPickDay,
  weekStart,
  byDay,
  classesByDay,
  academicByDay,
  colorMap,
  now,
  onSelect,
}: {
  onPickDay: (dayKey: string) => void;
  weekStart: Date;
  byDay: Map<string, Deadline[]>;
  classesByDay: Map<string, ClassSession[]>;
  academicByDay: Map<string, ClassSession[]>;
  colorMap: Map<string, string>;
  now: number;
  onSelect: (d: Deadline) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayKey = dayKey(new Date(now));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] gap-1 pb-1">
          <span />
          {days.map((d) => (
            <button
              key={d.toISOString()}
              onClick={() => onPickDay(dayKey(d))}
              className={`text-center font-mono text-[10px] uppercase tracking-[0.16em] transition-colors hover:text-ink ${
                dayKey(d) === todayKey ? "text-cyan" : "text-faint"
              }`}
            >
              {WEEKDAYS[(d.getDay() + 6) % 7]} {d.getDate()}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] gap-1 pb-1">
          <span />
          {days.map((d) => (
            <div key={`acad-${dayKey(d)}`} className="flex flex-col gap-0.5">
              {(academicByDay.get(dayKey(d)) ?? []).map((e) => (
                <AcademicChip key={e.id} entry={e} dense />
              ))}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] gap-1">
          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              <span className="py-2 text-right font-mono text-[10px] text-faint">
                {String(hour).padStart(2, "0")}:00
              </span>
              {days.map((d) => {
                const events = (byDay.get(dayKey(d)) ?? []).filter(
                  (e) => new Date(e.due_at).getHours() === hour,
                );
                const classes = (classesByDay.get(dayKey(d)) ?? []).filter(
                  (s) => new Date(s.start_at).getHours() === hour,
                );
                return (
                  <div
                    key={`${dayKey(d)}-${hour}`}
                    className="min-h-[36px] rounded-md bg-surface/60 p-1 ring-1 ring-border/60"
                  >
                    <div className="flex flex-col gap-1">
                      {classes.map((s) => {
                        const color = sessionColor(s, colorMap) ?? FALLBACK_COURSE_COLOR;
                        return (
                          <span
                            key={s.id}
                            title={[s.course_name ?? s.title, s.faculty_name, s.classroom]
                              .filter(Boolean)
                              .join(" · ")}
                            className="flex items-center gap-1 truncate rounded-md px-1.5 py-1 font-mono text-[10px]"
                            style={{ color, backgroundColor: `${color}1a` }}
                          >
                            <span
                              className="size-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                            <span className="truncate">{s.short_name ?? s.title}</span>
                          </span>
                        );
                      })}
                      {events.map((e) => (
                        <EventPill key={e.id} deadline={e} now={now} onSelect={onSelect} showTime />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Agenda({
  focusDay,
  onClearFocus,
  cursor,
  deadlines,
  classes,
  academic,
  colorMap,
  now,
  onSelect,
}: {
  focusDay: string | null;
  onClearFocus: () => void;
  cursor: Date;
  deadlines: Deadline[];
  classes: ClassSession[];
  academic: ClassSession[];
  colorMap: Map<string, string>;
  now: number;
  onSelect: (d: Deadline) => void;
}) {
  const inMonth = (iso: string) => {
    if (focusDay) return dayKey(iso) === focusDay;
    const d = new Date(iso);
    return d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear();
  };

  type Row =
    | { kind: "deadline"; at: string; deadline: Deadline }
    | { kind: "class"; at: string; session: ClassSession }
    | { kind: "academic"; at: string; session: ClassSession };

  const rows: Row[] = [
    ...deadlines.filter((d) => inMonth(d.due_at)).map((d) => ({ kind: "deadline" as const, at: d.due_at, deadline: d })),
    ...classes.filter((s) => inMonth(s.start_at)).map((s) => ({ kind: "class" as const, at: s.start_at, session: s })),
    ...academic
      .filter((s) => inMonth(s.start_at) || inMonth(s.end_at))
      .map((s) => ({ kind: "academic" as const, at: s.start_at, session: s })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = dayKey(r.at);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }

  const backBar = focusDay ? (
    <motion.button
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClearFocus}
      className="self-start rounded-lg bg-surface2 px-3 py-1.5 font-mono text-[11px] text-cyan ring-1 ring-cyan/30"
    >
      ← Back to the whole month
    </motion.button>
  ) : null;

  if (rows.length === 0)
    return (
      <div className="flex flex-col gap-4">
        {backBar}
        <p className="py-10 text-center font-mono text-xs text-faint">
          Nothing scheduled {focusDay ? "on this day" : "this month"}.
        </p>
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      {backBar}
      {[...groups.entries()].map(([key, list]) => (
        <div key={key}>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
            {agendaFmt.format(new Date(list[0]!.at))}
          </p>
          <div className="flex flex-col gap-2">
            {list.map((row) => {
              if (row.kind === "deadline") {
                const d = row.deadline;
                const m = eventMeta(d.type);
                const critical = urgencyOf(d.due_at, now) === "critical";
                return (
                  <motion.button
                    key={d.id}
                    whileHover={{ scale: 1.02, y: -2 }}
                    onClick={() => onSelect(d)}
                    className="flex items-center gap-3 rounded-xl bg-surface px-3 py-3 text-left ring-1 ring-border transition-shadow hover:shadow-lg hover:shadow-black/30"
                  >
                    <span className={`h-8 w-0.5 shrink-0 rounded-full ${m.bar}`} />
                    <span className="font-mono text-[11px] text-dim">
                      {timeFmt.format(new Date(d.due_at))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-sm font-semibold">
                        {d.title}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-dim">
                        {[d.subject_code, d.subject].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-md px-2 py-1 font-mono text-[10px] ${m.chip}`}>
                      {m.label}
                    </span>
                    {critical && <span className={`size-2 shrink-0 rounded-full ${m.dot} pulse-dot`} />}
                  </motion.button>
                );
              }

              const s = row.session;
              if (row.kind === "academic")
                return (
                  <div
                    key={`${s.id}-acad`}
                    className={`rounded-xl px-3 py-2.5 ring-1 ${
                      s.is_holiday
                        ? "bg-evt-present/10 ring-evt-present/30"
                        : "bg-cyan/10 ring-cyan/30"
                    }`}
                  >
                    <p className="font-display text-sm font-semibold">{s.title}</p>
                    <p className="font-mono text-[10px] text-dim">
                      Academic calendar ·{" "}
                      {rangeFmt.format(new Date(s.start_at))} — {rangeFmt.format(new Date(s.end_at))}
                    </p>
                  </div>
                );

              const color = sessionColor(s, colorMap) ?? FALLBACK_COURSE_COLOR;
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl bg-surface/70 px-3 py-2.5 ring-1 ring-border"
                >
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="font-mono text-[11px] text-dim">
                    {timeFmt.format(new Date(s.start_at))}–{timeFmt.format(new Date(s.end_at))}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-display text-sm">
                    {s.course_name ?? s.short_name ?? s.title}
                  </span>
                  <span className="hidden shrink-0 truncate font-mono text-[10px] text-faint sm:block">
                    {[s.faculty_name, s.classroom].filter(Boolean).join(" · ")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Legend() {
  const entries: { label: string; cls: string; shape: MarkerShape }[] = [
    { label: SHAPE_LABEL.star, cls: "bg-evt-exam", shape: "star" },
    { label: SHAPE_LABEL.triangle, cls: "bg-evt-quiz", shape: "triangle" },
    { label: SHAPE_LABEL.square, cls: "bg-evt-assign", shape: "square" },
    { label: SHAPE_LABEL.diamond, cls: "bg-evt-present", shape: "diamond" },
    { label: SHAPE_LABEL.pentagon, cls: "bg-evt-lecture", shape: "pentagon" },
    { label: SHAPE_LABEL.bar, cls: "bg-evt-present", shape: "bar" },
    { label: SHAPE_LABEL.circle, cls: "bg-dim", shape: "circle" },
  ];
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Shapes</span>
      {entries.map((e) => (
        <span key={e.label} className="flex items-center gap-1.5 font-mono text-[10px] text-dim">
          <Marker shape={e.shape} size={9} className={e.cls} /> {e.label}
        </span>
      ))}
    </div>
  );
}
