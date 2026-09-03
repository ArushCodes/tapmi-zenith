import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Search, X } from "lucide-react";
import { useBatch } from "@/hooks/use-batch";
import { sessionsQuery } from "@/lib/batches";
import { deadlinesQueryFor, eventMeta, fullDeadlineLabel } from "@/lib/deadlines";
import { sessionFullName, sessionMeta } from "@/lib/courses";

const whenFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

type Hit =
  | { kind: "deadline"; id: string; title: string; sub: string; at: number; tone: string }
  | { kind: "session"; id: string; title: string; sub: string; at: number; tone: string };

/** One search box for the whole site: every event and every class. */
export function GlobalSearch() {
  const { batchId } = useBatch();
  const { data: deadlines = [] } = useQuery(deadlinesQueryFor(batchId));
  const { data: sessions = [] } = useQuery(sessionsQuery(batchId));

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const hits = useMemo<Hit[]>(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const out: Hit[] = [];

    for (const d of deadlines) {
      if ((d.status ?? "approved") !== "approved") continue;
      const hay = [d.title, d.subject, d.subject_code, d.location, d.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle)) continue;
      const meta = eventMeta(d.type);
      out.push({
        kind: "deadline",
        id: d.id,
        title: fullDeadlineLabel(d),
        sub: `${meta.label} · ${whenFmt.format(new Date(d.due_at))}`,
        at: new Date(d.due_at).getTime(),
        tone: meta.text,
      });
    }

    for (const s of sessions) {
      const hay = [s.title, s.course_name, s.short_name, s.course_code, s.faculty_name, s.classroom]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle)) continue;
      out.push({
        kind: "session",
        id: s.id,
        title: sessionFullName(s),
        sub: `Class · ${whenFmt.format(new Date(s.start_at))}${
          sessionMeta(s).length ? ` · ${sessionMeta(s).join(" · ")}` : ""
        }`,
        at: new Date(s.start_at).getTime(),
        tone: "text-cyan",
      });
    }

    const now = Date.now();
    return out
      .sort((a, b) => Math.abs(a.at - now) - Math.abs(b.at - now))
      .slice(0, 20);
  }, [q, deadlines, sessions]);

  function pick(hit: Hit) {
    setOpen(false);
    setQ("");
    if (hit.kind === "deadline") {
      window.dispatchEvent(new CustomEvent("zenith:open-deadline", { detail: hit.id }));
    } else {
      window.dispatchEvent(new CustomEvent("zenith:goto-tab", { detail: "timetable" }));
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-dim" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search events & classes…"
        aria-label="Search events and classes"
        className="w-36 rounded-xl border border-border bg-surface py-2 pl-9 pr-8 text-[13px] text-ink outline-none transition-all placeholder:text-dim focus:w-56 focus:border-cyan/40 sm:w-52 sm:focus:w-72"
      />
      {q && (
        <button
          onClick={() => {
            setQ("");
            setOpen(false);
          }}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-dim hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      )}

      <AnimatePresence>
        {open && q.trim().length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 max-h-[60vh] w-[min(24rem,88vw)] overflow-auto rounded-xl border border-border bg-surface p-1.5 shadow-2xl shadow-black/20"
          >
            {hits.length === 0 ? (
              <p className="px-3 py-4 text-center font-mono text-[11px] text-dim">
                Nothing matches “{q.trim()}”.
              </p>
            ) : (
              hits.map((h) => (
                <button
                  key={`${h.kind}-${h.id}`}
                  onClick={() => pick(h)}
                  className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface2"
                >
                  <CalendarClock className={`mt-0.5 size-3.5 shrink-0 ${h.tone}`} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-ink">
                      {h.title}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-dim">{h.sub}</span>
                  </span>
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
