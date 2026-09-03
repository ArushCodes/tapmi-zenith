import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { db as supabase } from "@/lib/backend";
import { useAuth } from "@/hooks/use-auth";
import { useBatch } from "@/hooks/use-batch";
import { BoardHeader } from "@/components/board/BoardHeader";
import { DeadlineDialog } from "@/components/board/DeadlineDialog";
import {
  deadlinesQueryFor,
  formatDue,
  fullDeadlineLabel,
  typeLabel,
  type Deadline,
} from "@/lib/deadlines";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Moderator console — Zenith" },
      {
        name: "description",
        content:
          "Moderator console for managing Zenith deadlines: subjects, due dates, submission links and group tags.",
      },
      { property: "og:title", content: "Moderator console — Zenith" },
      {
        property: "og:description",
        content: "Manage upcoming deadlines for your batch on Zenith.",
      },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isModerator, loading } = useAuth();
  const queryClient = useQueryClient();
  const { batchId } = useBatch();
  const { data: deadlines = [] } = useQuery(deadlinesQueryFor(batchId));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Deadline | null>(null);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deadlines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deadlines"] });
      toast.success("Deadline removed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-ground font-body text-ink">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="aurora-c absolute right-[-60px] top-[120px] h-[360px] w-[480px] rounded-full bg-violet/20 blur-[130px]" />
        <div className="aurora-a absolute -left-16 -top-24 h-[380px] w-[520px] rounded-full bg-cyan/15 blur-[120px]" />
      </div>

      <BoardHeader />

      <main className="relative z-10 mx-auto max-w-[1180px] px-5 pb-16">
        {loading ? (
          <p className="mt-16 text-center font-mono text-xs text-faint">Checking your access…</p>
        ) : !isModerator ? (
          <div className="mx-auto mt-16 max-w-md rounded-2xl bg-surface p-6 text-center ring-1 ring-border">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-rose">
              Moderators only
            </p>
            <h1 className="mt-2 font-display text-xl font-semibold tracking-tight">
              You have read-only access
            </h1>
            <p className="mt-2 text-sm text-dim">
              Students can view the board but cannot manage deadlines. Ask an admin to grant you
              moderator access.
            </p>
            <Link
              to="/"
              className="mt-5 inline-block rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-ground"
            >
              Back to the board
            </Link>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl bg-surface2/60 p-5 ring-1 ring-border backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
                  Moderator console
                </p>
                <h1 className="font-display text-lg font-semibold tracking-tight">
                  Manage upcoming deadlines
                </h1>
              </div>
              <button
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
                className="rounded-lg bg-cyan px-3 py-2 text-sm font-semibold text-ground ring-1 ring-cyan"
              >
                New deadline
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-lg ring-1 ring-border">
              <div className="hidden grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-4 border-b border-border bg-surface px-4 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-faint sm:grid">
                <span>Deadline</span>
                <span className="text-right">Type</span>
                <span className="text-right">Due</span>
                <span className="text-right">Actions</span>
              </div>

              {deadlines.length === 0 && (
                <p className="px-4 py-6 text-center font-mono text-[11px] text-faint">
                  No deadlines on the board yet.
                </p>
              )}

              {deadlines.map((d, i) => (
                <div
                  key={d.id}
                  className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] ${
                    i > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {fullDeadlineLabel(d)}
                    </p>
                    <p className="truncate font-mono text-[11px] text-faint">
                      {[d.subject_code, d.work_mode === "group" ? `Group${d.group_size ? ` · ${d.group_size}` : ""}` : "Individual", d.submission_link]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span className="hidden font-mono text-[11px] text-dim sm:block">
                    {typeLabel(d.type)}
                  </span>
                  <span className="hidden font-mono text-[11px] text-dim sm:block">
                    {formatDue(d.due_at)}
                  </span>
                  <div className="flex justify-self-end gap-1">
                    <button
                      onClick={() => {
                        setEditing(d);
                        setDialogOpen(true);
                      }}
                      className="rounded-md px-2 py-1 font-mono text-[11px] text-dim ring-1 ring-border transition-colors hover:text-amber"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove.mutate(d.id)}
                      className="rounded-md px-2 py-1 font-mono text-[11px] text-dim ring-1 ring-border transition-colors hover:text-rose"
                    >
                      Del
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {isModerator && (
        <DeadlineDialog open={dialogOpen} onOpenChange={setDialogOpen} deadline={editing} />
      )}
    </div>
  );
}
