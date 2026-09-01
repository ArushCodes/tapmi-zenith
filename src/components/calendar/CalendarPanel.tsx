import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, ListOrdered } from "lucide-react";
import { dayKey, eventMeta, urgencyOf, type Deadline } from "@/lib/deadlines";

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
  now: number;
  onSelect: (d: Deadline) => void;
};

export function CalendarPanel({ deadlines, now, onSelect }: Props) {
  const [subView, setSubView] = useState<SubView>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [direction, setDirection] = useState(1);

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
              onClick={() => setSubView(v.key)}
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
              <MonthGrid cursor={cursor} byDay={byDay} now={now} onSelect={onSelect} />
            )}
            {subView === "week" && (
              <WeekTimeline weekStart={weekStart} byDay={byDay} now={now} onSelect={onSelect} />
            )}
            {subView === "agenda" && (
              <Agenda cursor={cursor} deadlines={deadlines} now={now} onSelect={onSelect} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <Legend />
    </section>
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
      <span
        className={`size-1.5 shrink-0 rounded-full ${m.dot} ${critical && deadline.is_major ? "pulse-dot" : ""}`}
      />
      {showTime && <span className="shrink-0 opacity-80">{timeFmt.format(new Date(deadline.due_at))}</span>}
      <span className="truncate">{deadline.subject_code ?? deadline.subject}</span>
    </motion.button>
  );
}

function MonthGrid({
  cursor,
  byDay,
  now,
  onSelect,
}: {
  cursor: Date;
  byDay: Map<string, Deadline[]>;
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
          const inMonth = date.getMonth() === cursor.getMonth();
          const isToday = k === todayKey;
          return (
            <motion.div
              key={k}
              whileHover={{ scale: 1.02, y: -2 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className={`min-h-[74px] rounded-lg p-1.5 ring-1 transition-shadow sm:min-h-[110px] ${
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
                {events.length > 0 && (
                  <span className="font-mono text-[9px] text-faint">{events.length}</span>
                )}
              </div>
              <div className="mt-1 flex flex-col gap-1">
                {events.slice(0, 3).map((d) => (
                  <EventPill key={d.id} deadline={d} now={now} onSelect={onSelect} />
                ))}
                {events.length > 3 && (
                  <span className="pl-1 font-mono text-[9px] text-faint">
                    +{events.length - 3} more
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
  weekStart,
  byDay,
  now,
  onSelect,
}: {
  weekStart: Date;
  byDay: Map<string, Deadline[]>;
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
            <span
              key={d.toISOString()}
              className={`text-center font-mono text-[10px] uppercase tracking-[0.16em] ${
                dayKey(d) === todayKey ? "text-cyan" : "text-faint"
              }`}
            >
              {WEEKDAYS[(d.getDay() + 6) % 7]} {d.getDate()}
            </span>
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
                return (
                  <div
                    key={`${dayKey(d)}-${hour}`}
                    className="min-h-[36px] rounded-md bg-surface/60 p-1 ring-1 ring-border/60"
                  >
                    <div className="flex flex-col gap-1">
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
  cursor,
  deadlines,
  now,
  onSelect,
}: {
  cursor: Date;
  deadlines: Deadline[];
  now: number;
  onSelect: (d: Deadline) => void;
}) {
  const items = deadlines
    .filter((d) => {
      const due = new Date(d.due_at);
      return due.getMonth() === cursor.getMonth() && due.getFullYear() === cursor.getFullYear();
    })
    .sort((a, b) => a.due_at.localeCompare(b.due_at));

  const groups = new Map<string, Deadline[]>();
  for (const d of items) {
    const k = dayKey(d.due_at);
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }

  if (items.length === 0)
    return (
      <p className="py-10 text-center font-mono text-xs text-faint">
        Nothing scheduled this month.
      </p>
    );

  return (
    <div className="flex flex-col gap-4">
      {[...groups.entries()].map(([key, list]) => (
        <div key={key}>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
            {agendaFmt.format(new Date(list[0]!.due_at))}
          </p>
          <div className="flex flex-col gap-2">
            {list.map((d) => {
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
                  {critical && (
                    <span className={`size-2 shrink-0 rounded-full ${m.dot} pulse-dot`} />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Legend() {
  const entries = [
    { label: "Midterm / Endterm", cls: "bg-evt-exam" },
    { label: "Quiz", cls: "bg-evt-quiz" },
    { label: "Assignment", cls: "bg-evt-assign" },
    { label: "Presentation", cls: "bg-evt-present" },
    { label: "Guest lecture / Other", cls: "bg-evt-lecture" },
  ];
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4">
      {entries.map((e) => (
        <span key={e.label} className="flex items-center gap-1.5 font-mono text-[10px] text-dim">
          <span className={`size-2 rounded-full ${e.cls}`} /> {e.label}
        </span>
      ))}
    </div>
  );
}
