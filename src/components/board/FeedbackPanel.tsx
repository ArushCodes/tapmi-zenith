import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bug, Check, Lightbulb, MessageSquare, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useBatch } from "@/hooks/use-batch";
import { useMe } from "@/hooks/use-me";
import { FEEDBACK_KINDS, feedbackQuery, type Feedback, type FeedbackKind } from "@/lib/feedback";

const kindIcon: Record<string, React.ReactNode> = {
  bug: <Bug className="size-3.5" />,
  suggestion: <Lightbulb className="size-3.5" />,
  feedback: <MessageSquare className="size-3.5" />,
  other: <Sparkles className="size-3.5" />,
};

export function FeedbackPanel() {
  const { user, isAdmin } = useAuth();
  const { batchId } = useBatch();
  const me = useMe();
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useQuery(feedbackQuery(user?.id));

  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [message, setMessage] = useState("");

  const send = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first");
      const body = message.trim();
      if (body.length < 5) throw new Error("Add a little more detail");
      const { error } = await supabase.from("feedback").insert({
        user_id: user.id,
        batch_id: batchId,
        kind,
        message: body,
        page: typeof window === "undefined" ? null : window.location.pathname,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
      toast.success("Sent — thank you!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("feedback").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feedback"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feedback").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feedback"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl bg-surface p-5 ring-1 ring-border"
      >
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {me.name ? `What's on your mind, ${me.name}?` : "Send feedback"}
        </h2>
        <p className="mt-1 font-mono text-[11px] text-dim">
          Bugs, ideas, gripes — it all lands straight with the admins.
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {FEEDBACK_KINDS.map((k) => (
            <motion.button
              key={k.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setKind(k.key)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wide ring-1 transition-colors ${
                kind === k.key
                  ? "bg-cyan/15 text-cyan ring-cyan/40"
                  : "text-dim ring-border hover:text-ink"
              }`}
            >
              {kindIcon[k.key]}
              {k.label}
            </motion.button>
          ))}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          placeholder="Describe the bug, the idea, or the thing that annoyed you…"
          className="mt-3 w-full resize-y rounded-xl bg-ground px-3 py-2.5 text-sm text-ink outline-none ring-1 ring-border placeholder:text-faint focus:ring-cyan/50"
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] text-faint">{message.trim().length} chars</span>
          <motion.button
            whileTap={{ scale: 0.96 }}
            disabled={send.isPending}
            onClick={() => send.mutate()}
            className="flex items-center gap-2 rounded-lg bg-cyan px-4 py-2 font-mono text-[11px] uppercase tracking-wide text-ground disabled:opacity-60"
          >
            <Send className="size-3.5" /> {send.isPending ? "Sending…" : "Send"}
          </motion.button>
        </div>
      </motion.section>

      <section>
        <div className="mb-2 flex items-center gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
            {isAdmin ? "All submissions" : "Your submissions"}
          </p>
          <span className="h-px flex-1 bg-border" />
          <p className="font-mono text-[10px] text-faint">{items.length}</p>
        </div>

        {isLoading ? (
          <p className="py-6 text-center font-mono text-xs text-faint">Loading…</p>
        ) : items.length === 0 ? (
          <p className="py-6 text-center font-mono text-xs text-faint">
            Nothing sent yet — the box on the left is waiting.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {items.map((f: Feedback) => (
                <motion.article
                  key={f.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  whileHover={{ scale: 1.01 }}
                  className="rounded-xl bg-surface p-3.5 ring-1 ring-border"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 rounded-md bg-surface2 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-dim">
                      {kindIcon[f.kind] ?? kindIcon.other}
                      {f.kind}
                    </span>
                    <span
                      className={`rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wide ${
                        f.status === "resolved"
                          ? "bg-evt-present/15 text-evt-present"
                          : "bg-amber/15 text-amber"
                      }`}
                    >
                      {f.status}
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-faint">
                      {new Date(f.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{f.message}</p>

                  {isAdmin && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() =>
                          setStatus.mutate({
                            id: f.id,
                            status: f.status === "resolved" ? "open" : "resolved",
                          })
                        }
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-evt-present ring-1 ring-border"
                      >
                        <Check className="size-3.5" />
                        {f.status === "resolved" ? "Reopen" : "Mark resolved"}
                      </button>
                      <button
                        onClick={() => remove.mutate(f.id)}
                        aria-label="Delete feedback"
                        className="rounded-lg p-1.5 text-dim ring-1 ring-border transition-colors hover:text-rose"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )}
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  );
}
