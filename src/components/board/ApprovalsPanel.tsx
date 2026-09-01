import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { eventMeta, formatDue, type Deadline } from "@/lib/deadlines";

type Props = {
  deadlines: Deadline[];
  onSelect: (d: Deadline) => void;
};

export function ApprovalsPanel({ deadlines, onSelect }: Props) {
  const queryClient = useQueryClient();

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("deadlines").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["deadlines"] });
      toast.success(vars.status === "approved" ? "Event published to the board" : "Submission rejected");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const pending = deadlines.filter((d) => d.status === "pending");
  const rejected = deadlines.filter((d) => d.status === "rejected");

  return (
    <section className="mt-4 flex flex-col gap-6">
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-amber">
          Awaiting review · {pending.length}
        </p>
        {pending.length === 0 ? (
          <p className="rounded-xl bg-surface px-4 py-8 text-center font-mono text-xs text-faint ring-1 ring-border">
            No submissions waiting for approval.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {pending.map((d) => {
              const m = eventMeta(d.type);
              return (
                <motion.div
                  key={d.id}
                  layout
                  whileHover={{ scale: 1.01, y: -2 }}
                  className="flex flex-wrap items-center gap-3 rounded-xl bg-surface px-4 py-3 ring-1 ring-border"
                >
                  <span className={`h-8 w-0.5 rounded-full ${m.bar}`} />
                  <button onClick={() => onSelect(d)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate font-display text-sm font-semibold">
                      {d.subject} — {d.title}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-dim">
                      {[d.subject_code, formatDue(d.due_at)].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                  <span className={`rounded-md px-2 py-1 font-mono text-[10px] ${m.chip}`}>
                    {m.label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => decide.mutate({ id: d.id, status: "approved" })}
                      className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[11px] text-dim ring-1 ring-border transition-colors hover:text-evt-present hover:ring-evt-present/40"
                    >
                      <Check className="size-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => decide.mutate({ id: d.id, status: "rejected" })}
                      className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[11px] text-dim ring-1 ring-border transition-colors hover:text-rose hover:ring-rose/40"
                    >
                      <X className="size-3.5" /> Reject
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {rejected.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
            Rejected · {rejected.length}
          </p>
          <div className="flex flex-col gap-2">
            {rejected.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-surface/60 px-4 py-2.5 ring-1 ring-border"
              >
                <span className="truncate font-mono text-[11px] text-faint">
                  {d.subject} — {d.title}
                </span>
                <button
                  onClick={() => decide.mutate({ id: d.id, status: "approved" })}
                  className="rounded-md px-2 py-1 font-mono text-[10px] text-dim ring-1 ring-border hover:text-evt-present"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
