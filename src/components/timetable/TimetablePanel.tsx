import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Copy, Link2, Plus, RefreshCw, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBatch } from "@/hooks/use-batch";
import { coursesQuery, sessionsQuery, syncStateQuery, type ClassSession } from "@/lib/batches";
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
  const [course, setCourse] = useState("all");
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
      const start = new Date(s.start_at);
      if (start < weekStart || start >= weekEnd) continue;
      if (course !== "all" && s.course_code !== course) continue;
      const k = start.toDateString();
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return [...map.entries()].sort(
      ([a], [b]) => new Date(a).getTime() - new Date(b).getTime(),
    );
  }, [sessions, weekStart, weekEnd, course]);

  const feedUrl = batch
    ? `${typeof window === "undefined" ? "" : window.location.origin}/api/public/ics/${batch.feed_token}.ics`
    : "";

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

        <select
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          className="rounded-lg bg-surface2 px-2.5 py-1.5 font-mono text-[11px] text-dim ring-1 ring-border outline-none"
        >
          <option value="all">All courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.code}>
              {c.short_name}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              void navigator.clipboard.writeText(feedUrl);
              toast.success("Calendar feed link copied");
            }}
            className="flex items-center gap-1.5 rounded-lg bg-surface2 px-2.5 py-1.5 font-mono text-[11px] text-dim ring-1 ring-border hover:text-ink"
          >
            <Copy className="size-3.5" /> Subscribe link
          </button>
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
                <Settings2 className="size-3.5" /> Registro
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
          <RegistroSettings
            onSave={async (v) => {
              await saveCreds({ data: { batchId: batchId!, ...v } });
              toast.success("Registro credentials saved");
              setShowSettings(false);
            }}
            feedUrl={feedUrl}
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

      {isLoading ? (
        <p className="mt-6 text-center font-mono text-xs text-faint">Loading timetable…</p>
      ) : grouped.length === 0 ? (
        <p className="mt-8 text-center font-mono text-xs text-faint">
          No classes this week. {canManage ? "Sync Registro or add a custom class." : ""}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {grouped.map(([day, list]) => (
            <div key={day}>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
                {dayFmt.format(new Date(day))}
              </p>
              <div className="flex flex-col gap-2">
                {list.map((s) => (
                  <motion.div
                    key={s.id}
                    whileHover={{ scale: 1.01, y: -2 }}
                    className={`flex items-center gap-3 rounded-xl bg-surface px-3 py-3 ring-1 transition-shadow hover:shadow-lg hover:shadow-black/30 ${
                      s.is_holiday ? "ring-evt-present/30" : "ring-border"
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
                    <span className="shrink-0 rounded-md bg-surface2 px-2 py-1 font-mono text-[10px] text-faint">
                      {s.source}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-8 flex items-center justify-center gap-2 font-mono text-[10px] text-faint">
        <Link2 className="size-3" /> Subscribe in Google/Apple Calendar with the feed link above
        <CalendarClock className="size-3" />
      </p>
    </section>
  );
}

function RegistroSettings({
  onSave,
  feedUrl,
}: {
  onSave: (v: { username: string; password: string; termId: string }) => Promise<void>;
  feedUrl: string;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [termId, setTermId] = useState("");
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
          await onSave({ username, password, termId });
          setPassword("");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not save");
        } finally {
          setBusy(false);
        }
      }}
      className="mb-5 overflow-hidden rounded-xl bg-surface p-4 ring-1 ring-border"
    >
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
        Shared Registro login for this batch
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Registro username"
          required
          className="rounded-lg bg-surface2 px-3 py-2 text-sm ring-1 ring-border outline-none focus:ring-cyan/40"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Registro password"
          required
          className="rounded-lg bg-surface2 px-3 py-2 text-sm ring-1 ring-border outline-none focus:ring-cyan/40"
        />
        <input
          value={termId}
          onChange={(e) => setTermId(e.target.value)}
          placeholder="Term session id"
          required
          className="rounded-lg bg-surface2 px-3 py-2 text-sm ring-1 ring-border outline-none focus:ring-cyan/40"
        />
      </div>
      <p className="mt-3 break-all font-mono text-[10px] text-faint">Feed: {feedUrl}</p>
      <button
        type="submit"
        disabled={busy}
        className="mt-3 rounded-lg bg-cyan px-3 py-1.5 text-sm font-semibold text-ground disabled:opacity-60"
      >
        Save credentials
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
        Add a class Registro does not have
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
