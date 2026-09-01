import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { BoardHeader } from "@/components/board/BoardHeader";
import { DeadlineRow } from "@/components/board/DeadlineRow";
import { DeadlineDialog } from "@/components/board/DeadlineDialog";
import {
  FILTERS,
  deadlinesQuery,
  formatWeek,
  weekKey,
  type Deadline,
  type FilterKey,
} from "@/lib/deadlines";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TAPMI IPM Deadline Board — Quizzes, Assignments & Exams" },
      {
        name: "description",
        content:
          "Live deadline board for the TAPMI IPM 2026–2031 batch: quizzes, assignments, presentations and exams sorted by time remaining.",
      },
      { property: "og:title", content: "TAPMI IPM Deadline Board" },
      {
        property: "og:description",
        content:
          "Every quiz, assignment, presentation and exam for the IPM 2026–2031 batch, sorted by time remaining.",
      },
    ],
  }),
  component: Board,
});

function Board() {
  const { isModerator } = useAuth();
  const queryClient = useQueryClient();
  const { data: deadlines = [], isLoading } = useQuery(deadlinesQuery);

  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "timeline">("list");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Deadline | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remove = useMutation({
    mutationFn: async (deadline: Deadline) => {
      const { error } = await supabase.from("deadlines").delete().eq("id", deadline.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deadlines"] });
      toast.success("Deadline removed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filtered = useMemo(() => {
    const active = FILTERS.find((f) => f.key === filter);
    const q = search.trim().toLowerCase();
    return deadlines.filter((d) => {
      if (active?.types && !active.types.includes(d.type as never)) return false;
      if (!q) return true;
      return [d.title, d.subject, d.subject_code, d.location, d.notes]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }, [deadlines, filter, search]);

  const weeks = useMemo(() => {
    const map = new Map<string, Deadline[]>();
    for (const d of filtered) {
      const k = weekKey(d.due_at);
      map.set(k, [...(map.get(k) ?? []), d]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  function openEdit(d: Deadline) {
    setEditing(d);
    setDialogOpen(true);
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-ground font-body text-ink">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="aurora-a absolute -left-16 -top-24 h-[380px] w-[520px] rounded-full bg-cyan/20 blur-[120px]" />
        <div className="aurora-c absolute right-[-60px] top-[220px] h-[360px] w-[480px] rounded-full bg-violet/20 blur-[130px]" />
        <div className="aurora-b absolute bottom-[-120px] left-[35%] h-[420px] w-[560px] rounded-full bg-magenta/15 blur-[140px]" />
      </div>

      <BoardHeader />

      <main className="relative z-10 mx-auto max-w-[1180px] px-5 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-dim">
              Departures · sorted by time remaining
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-balance">
              Next up on the board
            </h1>
          </div>
          <p className="font-mono text-xs text-faint">
            {new Intl.DateTimeFormat("en-GB", {
              weekday: "short",
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }).format(new Date(now))}
          </p>
        </div>

        <div className="sticky top-0 z-20 -mx-5 mb-5 bg-ground/80 px-5 py-3 backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={
                    filter === f.key
                      ? "rounded-lg bg-cyan/15 px-3 py-1.5 font-mono text-xs font-medium text-cyan ring-1 ring-cyan/30"
                      : "rounded-lg px-3 py-1.5 font-mono text-xs text-dim ring-1 ring-border transition-colors hover:text-ink"
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-faint">
                  ⌕
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search subject or code…"
                  aria-label="Search deadlines"
                  className="w-44 rounded-lg bg-surface2/70 py-1.5 pl-8 pr-3 text-sm text-ink ring-1 ring-border outline-none placeholder:text-faint focus:ring-cyan/40 sm:w-56"
                />
              </div>

              <div className="flex rounded-lg bg-surface2/70 p-0.5 ring-1 ring-border">
                {(["list", "timeline"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={
                      view === v
                        ? "rounded-md bg-surface px-2.5 py-1 font-mono text-[11px] text-ink"
                        : "rounded-md px-2.5 py-1 font-mono text-[11px] text-dim"
                    }
                  >
                    {v === "list" ? "List" : "Timeline"}
                  </button>
                ))}
              </div>

              {isModerator && (
                <button
                  onClick={() => {
                    setEditing(null);
                    setDialogOpen(true);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-cyan px-3 py-1.5 text-sm font-semibold text-ground ring-1 ring-cyan shadow-[0_0_24px_-6px_var(--cyan)]"
                >
                  <span className="text-base leading-none">+</span> Add
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-faint sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <span>Subject · due</span>
          <span className="hidden text-right sm:block">Type</span>
          <span className="hidden text-right sm:block">Work</span>
          <span className="text-right">Time left</span>
        </div>

        {isLoading ? (
          <p className="mt-6 text-center font-mono text-xs text-faint">Loading the board…</p>
        ) : filtered.length === 0 ? (
          <p className="mt-6 text-center font-mono text-xs text-faint">
            Nothing on the board for this filter.
          </p>
        ) : view === "list" ? (
          <div className="mt-2 flex flex-col gap-2">
            {filtered.map((d) => (
              <DeadlineRow
                key={d.id}
                deadline={d}
                now={now}
                canManage={isModerator}
                onEdit={openEdit}
                onDelete={(x) => remove.mutate(x)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-6">
            {weeks.map(([week, items]) => (
              <section key={week}>
                <div className="mb-2 flex items-center gap-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
                    {formatWeek(week)}
                  </p>
                  <span className="h-px flex-1 bg-border" />
                  <p className="font-mono text-[10px] text-faint">{items.length} items</p>
                </div>
                <div className="flex flex-col gap-2 border-l border-border pl-4">
                  {items.map((d) => (
                    <DeadlineRow
                      key={d.id}
                      deadline={d}
                      now={now}
                      canManage={isModerator}
                      onEdit={openEdit}
                      onDelete={(x) => remove.mutate(x)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <p className="mt-10 text-center font-mono text-[11px] text-faint">
          Read-only for the batch · add, edit and delete are moderator-only
        </p>
      </main>

      {isModerator && (
        <DeadlineDialog open={dialogOpen} onOpenChange={setDialogOpen} deadline={editing} />
      )}
    </div>
  );
}
