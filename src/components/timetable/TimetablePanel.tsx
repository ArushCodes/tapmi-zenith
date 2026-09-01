import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, RefreshCw, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBatch } from "@/hooks/use-batch";
import { coursesQuery, sessionsQuery, syncStateQuery, type ClassSession, type Course } from "@/lib/batches";
import { saveIcsUrl, syncTimetableNow } from "@/lib/timetable.functions";

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

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function TimetablePanel() {
  const { batchId, batch, canManage } = useBatch();
  const queryClient = useQueryClient();
  const { data: sessions = [], isLoading } = useQuery(sessionsQuery(batchId));
  const { data: courses = [] } = useQuery(coursesQuery(batchId));
  const { data: syncState } = useQuery(syncStateQuery(batchId, canManage));

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selected, setSelected] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showCustom, setShowCustom] = useState(false);

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

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const grouped = useMemo(() => {
    const map = new Map<string, ClassSession[]>();
    for (const s of sessions) {
      if (s.notes === "academic-calendar") continue;
      const start = new Date(s.start_at);
      if (start < weekStart || start >= weekEnd) continue;
      if (selected.length > 0 && !selected.includes(sessionKey(s))) continue;
      const k = start.toDateString();
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return [...map.entries()].sort(
      ([a], [b]) => new Date(a).getTime() - new Date(b).getTime(),
    );
  }, [sessions, weekStart, weekEnd, selected]);

  /** Every class that appears anywhere in the feed, plus catalogued courses. */
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
        color: c.color ?? FALLBACK_COURSE_COLOR,
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
        label: s.short_name ?? s.course_name ?? s.title,
        sub: [s.course_code, s.faculty_name].filter(Boolean).join(" · "),
        color: FALLBACK_COURSE_COLOR,
        count: 1,
      });
    }
    return [...m.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [courses, sessions]);

  const colorMap = useMemo(() => buildColorMap(courses), [courses]);

  const colorOf = (s: ClassSession) => sessionColor(s, colorMap);


  return (
    <section className="mt-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            const next = new Date(weekStart);
            next.setDate(weekStart.getDate() - 7);
            setWeekStart(next);
          }}
          className="rounded-lg bg-surface2 px-3 py-1.5 font-mono text-[11px] text-dim ring-1 ring-border hover:text-ink"
        >
          ← Prev
        </button>
        <button
          onClick={() => setWeekStart(startOfWeek(new Date()))}
          className="rounded-lg bg-surface2 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-dim ring-1 ring-border hover:text-ink"
        >
          This week
        </button>
        <button
          onClick={() => {
            const next = new Date(weekStart);
            next.setDate(weekStart.getDate() + 7);
            setWeekStart(next);
          }}
          className="rounded-lg bg-surface2 px-3 py-1.5 font-mono text-[11px] text-dim ring-1 ring-border hover:text-ink"
        >
          Next →
        </button>

        <div className="ml-auto flex items-center gap-2">

          {canManage && (
            <>
              <button
                onClick={() => setShowCustom((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg bg-surface2 px-2.5 py-1.5 font-mono text-[11px] text-dim ring-1 ring-border hover:text-ink"
              >
                <Plus className="size-3.5" /> Custom class
              </button>
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
        {showCustom && canManage && (
          <CustomClassForm
            batchId={batchId!}
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



      {isLoading ? (
        <p className="mt-6 text-center font-mono text-xs text-faint">Loading timetable…</p>
      ) : grouped.length === 0 ? (
        <p className="mt-8 text-center font-mono text-xs text-faint">
          No classes this week. {canManage ? "Paste a calendar link and sync, or add a custom class." : ""}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {grouped.map(([day, list]) => (
            <div key={day}>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
                {dayFmt.format(new Date(day))}
              </p>
              <div className="flex flex-col gap-2">
                {list.map((s) => {
                  const color = colorOf(s);
                  return (
                    <motion.div
                      key={s.id}
                      whileHover={{ scale: 1.01, y: -2 }}
                      style={{ borderLeftColor: color ?? "transparent" }}
                      className={`flex items-center gap-3 rounded-xl border-l-[3px] bg-surface px-3 py-3 ring-1 transition-shadow hover:shadow-lg hover:shadow-black/30 ${
                        s.is_holiday ? "border-l-evt-present ring-evt-present/30" : "ring-border"
                      }`}
                    >
                      <span className="font-mono text-[11px] text-dim">
                        {timeFmt.format(new Date(s.start_at))}–{timeFmt.format(new Date(s.end_at))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-sm font-semibold">
                          {s.title}
                        </span>
                        <span className="block truncate font-mono text-[11px] text-dim">
                          {[s.course_name, s.faculty_name, s.classroom, s.section]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </span>
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
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
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
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[10px] transition-opacity ${
                dimmed ? "opacity-40" : "opacity-100"
              }`}
              style={{
                color: o.color,
                backgroundColor: `${o.color}1a`,
                boxShadow: isOn ? `0 0 0 1px ${o.color}` : undefined,
              }}
            >
              {isOn ? (
                <Check className="size-3" />
              ) : (
                <span className="size-2 rounded-full" style={{ backgroundColor: o.color }} />
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

function CustomClassForm({ batchId, onDone }: { batchId: string; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [room, setRoom] = useState("");
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
        });
        setBusy(false);
        if (error) toast.error(error.message);
        else {
          toast.success("Custom class added");
          onDone();
        }
      }}
      className="mb-5 overflow-hidden rounded-xl bg-surface p-4 ring-1 ring-border"
    >
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
        Add a class the calendar feed does not have
      </p>
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
