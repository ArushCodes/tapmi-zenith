import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Mail, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useBatch } from "@/hooks/use-batch";
import { emailQueueQuery, type EmailIngest } from "@/lib/batches";
import type { Deadline } from "@/lib/deadlines";

type Extracted = {
  title?: string;
  subject?: string;
  subject_code?: string;
  type?: Deadline["type"];
  due_at?: string;
  work_mode?: Deadline["work_mode"];
  submission_link?: string;
  notes?: string;
};

const fmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function EmailInboxPanel() {
  const { user } = useAuth();
  const { batchId, canManage } = useBatch();
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useQuery(emailQueueQuery(batchId, canManage));
  const [openId, setOpenId] = useState<string | null>(null);

  const decide = useMutation({
    mutationFn: async ({
      item,
      approve,
      draft,
    }: {
      item: EmailIngest;
      approve: boolean;
      draft?: Extracted | undefined;
    }) => {
      if (approve) {
        const d = draft ?? ((item.extracted ?? {}) as Extracted);
        if (!d.title || !d.due_at) throw new Error("Title and due date are required");
        const { data: created, error } = await supabase
          .from("deadlines")
          .insert({
            batch_id: item.batch_id,
            title: d.title,
            subject: d.subject ?? "General",
            subject_code: d.subject_code ?? null,
            type: d.type ?? "assignment",
            due_at: new Date(d.due_at).toISOString(),
            work_mode: d.work_mode ?? "individual",
            submission_link: d.submission_link ?? null,
            notes: d.notes ?? null,
            status: "approved",
            source: "email",
            is_major: d.type === "midterm" || d.type === "endterm",
            created_by: user!.id,
          })
          .select("id")
          .single();
        if (error) throw error;
        const { error: upErr } = await supabase
          .from("email_ingest")
          .update({
            status: "approved",
            reviewed_by: user!.id,
            reviewed_at: new Date().toISOString(),
            deadline_id: created.id,
          })
          .eq("id", item.id);
        if (upErr) throw upErr;
      } else {
        const { error } = await supabase
          .from("email_ingest")
          .update({
            status: "rejected",
            reviewed_by: user!.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        if (error) throw error;
      }
    },
    onSuccess: (_r, v) => {
      queryClient.invalidateQueries({ queryKey: ["email-ingest", batchId] });
      queryClient.invalidateQueries({ queryKey: ["deadlines", batchId] });
      toast.success(v.approve ? "Deadline published" : "Email dismissed");
      setOpenId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canManage)
    return (
      <p className="mt-10 text-center font-mono text-xs text-faint">
        The email inbox is moderator-only.
      </p>
    );

  const pending = items.filter((i) => i.status === "pending");
  const handled = items.filter((i) => i.status !== "pending").slice(0, 12);

  return (
    <section className="mt-4 flex flex-col gap-6">
      <div>
        <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
          <Mail className="size-3.5" /> Detected in email · {pending.length}
        </p>
        {isLoading ? (
          <p className="font-mono text-xs text-faint">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="font-mono text-xs text-faint">
            Nothing waiting. Forwarded emails with deadlines will show up here for review.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {pending.map((item) => (
              <EmailCard
                key={item.id}
                item={item}
                open={openId === item.id}
                onToggle={() => setOpenId(openId === item.id ? null : item.id)}
                onDecide={(approve, draft) => decide.mutate({ item, approve, draft })}
                busy={decide.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {handled.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
            Recently reviewed
          </p>
          <div className="flex flex-col gap-1.5">
            {handled.map((i) => (
              <div
                key={i.id}
                className="flex items-center gap-3 rounded-lg bg-surface/60 px-3 py-2 ring-1 ring-border"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-dim">
                  {i.subject ?? "(no subject)"}
                </span>
                <span
                  className={`font-mono text-[10px] ${
                    i.status === "approved" ? "text-evt-present" : "text-evt-exam"
                  }`}
                >
                  {i.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function EmailCard({
  item,
  open,
  onToggle,
  onDecide,
  busy,
}: {
  item: EmailIngest;
  open: boolean;
  onToggle: () => void;
  onDecide: (approve: boolean, draft?: Extracted) => void;
  busy: boolean;
}) {
  const base = (item.extracted ?? {}) as Extracted;
  const [draft, setDraft] = useState<Extracted>(base);

  return (
    <motion.div layout className="rounded-xl bg-surface ring-1 ring-border">
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-3 py-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-sm font-semibold">
            {base.title ?? item.subject ?? "(no subject)"}
          </span>
          <span className="block truncate font-mono text-[11px] text-dim">
            {[item.sender, fmt.format(new Date(item.received_at))].filter(Boolean).join(" · ")}
          </span>
        </span>
        {item.confidence != null && (
          <span className="shrink-0 rounded-md bg-surface2 px-2 py-1 font-mono text-[10px] text-faint">
            {Math.round(item.confidence * 100)}%
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-border px-3 py-3"
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Title" value={draft.title ?? ""} onChange={(v) => setDraft({ ...draft, title: v })} />
              <Field label="Subject" value={draft.subject ?? ""} onChange={(v) => setDraft({ ...draft, subject: v })} />
              <Field
                label="Subject code"
                value={draft.subject_code ?? ""}
                onChange={(v) => setDraft({ ...draft, subject_code: v })}
              />
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-wide text-faint">Type</span>
                <select
                  value={draft.type ?? "assignment"}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value as Deadline["type"] })}
                  className="rounded-lg bg-surface2 px-3 py-2 text-sm ring-1 ring-border outline-none"
                >
                  {["quiz", "assignment", "presentation", "midterm", "endterm", "guest_lecture", "other"].map(
                    (t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <Field
                label="Due (local)"
                type="datetime-local"
                value={draft.due_at ? toLocalInput(draft.due_at) : ""}
                onChange={(v) => setDraft({ ...draft, due_at: v })}
              />
              <Field
                label="Submission link"
                value={draft.submission_link ?? ""}
                onChange={(v) => setDraft({ ...draft, submission_link: v })}
              />
            </div>

            {item.body && (
              <p className="mt-3 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg bg-surface2/60 p-2 font-mono text-[11px] text-dim">
                {item.body.slice(0, 1200)}
              </p>
            )}

            <div className="mt-3 flex gap-2">
              <button
                disabled={busy}
                onClick={() => onDecide(true, draft)}
                className="flex items-center gap-1.5 rounded-lg bg-cyan px-3 py-1.5 text-sm font-semibold text-ground disabled:opacity-60"
              >
                <Check className="size-3.5" /> Publish deadline
              </button>
              <button
                disabled={busy}
                onClick={() => onDecide(false)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[11px] text-dim ring-1 ring-border hover:text-rose disabled:opacity-60"
              >
                <X className="size-3.5" /> Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wide text-faint">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg bg-surface2 px-3 py-2 text-sm ring-1 ring-border outline-none focus:ring-cyan/40"
      />
    </label>
  );
}
