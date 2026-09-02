import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Megaphone, Pin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useBatch } from "@/hooks/use-batch";
import { announcementsQuery, timeAgo, type Announcement } from "@/lib/announcements";

export function AnnouncementsPanel({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const { batchId, canManage } = useBatch();
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useQuery(announcementsQuery(batchId));
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);

  const create = useMutation({
    mutationFn: async () => {
      if (!batchId) throw new Error("Select a batch first");
      const { error } = await supabase.from("announcements").insert({
        batch_id: batchId,
        title: title.trim(),
        body: body.trim(),
        pinned,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements", batchId] });
      setTitle("");
      setBody("");
      setPinned(false);
      setOpen(false);
      toast.success("Announcement posted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (a: Announcement) => {
      const { error } = await supabase.from("announcements").delete().eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements", batchId] });
      toast.success("Announcement removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = compact ? items.slice(0, 3) : items;

  return (
    <section className={compact ? "" : "mt-4"}>
      <div className="mb-3 flex items-center gap-2">
        <Megaphone className="size-3.5 text-amber" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber">
          {compact ? "Recent announcements" : "Announcements"}
        </p>
        {canManage && !compact && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-surface2 px-2.5 py-1.5 font-mono text-[11px] text-dim ring-1 ring-border hover:text-ink"
          >
            <Plus className="size-3.5" /> New
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && canManage && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) {
                toast.error("Give it a title");
                return;
              }
              create.mutate();
            }}
          >
            <div className="flex flex-col gap-2 rounded-xl bg-surface p-3 ring-1 ring-border">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                className="rounded-lg bg-ground px-3 py-2 text-sm text-ink ring-1 ring-border outline-none placeholder:text-faint focus:ring-cyan/50"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                placeholder="What does the batch need to know?"
                className="resize-none rounded-lg bg-ground px-3 py-2 text-sm text-ink ring-1 ring-border outline-none placeholder:text-faint focus:ring-cyan/50"
              />
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 font-mono text-[11px] text-dim">
                  <input
                    type="checkbox"
                    checked={pinned}
                    onChange={(e) => setPinned(e.target.checked)}
                  />
                  Pin to top
                </label>
                <button
                  type="submit"
                  disabled={create.isPending}
                  className="ml-auto rounded-lg bg-cyan px-3.5 py-1.5 font-mono text-[11px] font-semibold text-ground disabled:opacity-60"
                >
                  {create.isPending ? "Posting…" : "Post"}
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="h-14 animate-pulse rounded-xl bg-surface2/40" />
      ) : list.length === 0 ? (
        <p className="rounded-xl bg-surface/50 px-4 py-5 text-center font-mono text-[11px] text-faint ring-1 ring-border">
          No announcements yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {list.map((a, i) => (
              <motion.article
                key={a.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ delay: Math.min(i * 0.04, 0.24) }}
                whileHover={{ y: -2 }}
                className={`rounded-xl bg-surface p-3.5 ring-1 ${
                  a.pinned ? "ring-amber/40" : "ring-border"
                }`}
              >
                <div className="flex items-start gap-2">
                  {a.pinned && <Pin className="mt-0.5 size-3.5 shrink-0 text-amber" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-semibold leading-tight">{a.title}</p>
                    {a.body && (
                      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-dim">
                        {compact && a.body.length > 140 ? `${a.body.slice(0, 140)}…` : a.body}
                      </p>
                    )}
                    <p className="mt-1.5 font-mono text-[10px] text-faint">
                      {timeAgo(a.created_at)}
                    </p>
                  </div>
                  {canManage && !compact && (
                    <button
                      onClick={() => remove.mutate(a)}
                      className="rounded-md p-1.5 text-faint transition-colors hover:text-rose"
                      aria-label="Delete announcement"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
