import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEADLINE_TYPES, type Deadline, type DeadlineType } from "@/lib/deadlines";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deadline?: Deadline | null;
};

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const emptyForm = {
  title: "",
  subject: "",
  subject_code: "",
  type: "assignment" as DeadlineType,
  due_at: "",
  location: "",
  submission_link: "",
  work_mode: "individual" as "individual" | "group",
  group_size: "",
  notes: "",
};

const fieldClass =
  "w-full rounded-lg bg-ground px-3 py-2 text-sm text-ink ring-1 ring-border outline-none transition-shadow placeholder:text-faint focus:ring-cyan/50";
const labelClass = "font-mono text-[10px] uppercase tracking-[0.18em] text-dim";

export function DeadlineDialog({ open, onOpenChange, deadline }: Props) {
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    if (deadline) {
      setForm({
        title: deadline.title,
        subject: deadline.subject,
        subject_code: deadline.subject_code ?? "",
        type: deadline.type,
        due_at: toLocalInput(deadline.due_at),
        location: deadline.location ?? "",
        submission_link: deadline.submission_link ?? "",
        work_mode: deadline.work_mode,
        group_size: deadline.group_size ? String(deadline.group_size) : "",
        notes: deadline.notes ?? "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, deadline]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title.trim(),
        subject: form.subject.trim(),
        subject_code: form.subject_code.trim() || null,
        type: form.type,
        due_at: new Date(form.due_at).toISOString(),
        location: form.location.trim() || null,
        submission_link: form.submission_link.trim() || null,
        work_mode: form.work_mode,
        group_size: form.work_mode === "group" && form.group_size ? Number(form.group_size) : null,
        notes: form.notes.trim() || null,
        is_major: form.type === "midterm" || form.type === "endterm",
      };
      if (deadline) {
        const { error } = await supabase.from("deadlines").update(payload).eq("id", deadline.id);
        if (error) throw error;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        if (!batchId) throw new Error("Select a batch first");
        const { error } = await supabase
          .from("deadlines")
          .insert({ ...payload, batch_id: batchId, created_by: userData.user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deadlines"] });
      toast.success(deadline ? "Deadline updated" : "Deadline added to the board");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-border bg-surface2 text-ink">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-semibold tracking-tight">
            {deadline ? "Edit deadline" : "New deadline"}
          </DialogTitle>
        </DialogHeader>

        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.due_at) {
              toast.error("Pick a due date and time");
              return;
            }
            save.mutate();
          }}
        >
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="title">Title</label>
            <input
              id="title"
              required
              className={`${fieldClass} mt-1`}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Quiz 04 — Sampling Distributions"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="subject">Subject</label>
            <input
              id="subject"
              required
              className={`${fieldClass} mt-1`}
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Probability & Statistics"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="code">Subject code</label>
            <input
              id="code"
              className={`${fieldClass} mt-1 font-mono`}
              value={form.subject_code}
              onChange={(e) => setForm({ ...form, subject_code: e.target.value })}
              placeholder="MTH-301"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="type">Type</label>
            <select
              id="type"
              className={`${fieldClass} mt-1`}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as DeadlineType })}
            >
              {DEADLINE_TYPES.map((t) => (
                <option key={t.value} value={t.value} className="bg-ground">
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="due">Due</label>
            <input
              id="due"
              type="datetime-local"
              required
              className={`${fieldClass} mt-1 font-mono`}
              value={form.due_at}
              onChange={(e) => setForm({ ...form, due_at: e.target.value })}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="mode">Work</label>
            <select
              id="mode"
              className={`${fieldClass} mt-1`}
              value={form.work_mode}
              onChange={(e) =>
                setForm({ ...form, work_mode: e.target.value as "individual" | "group" })
              }
            >
              <option value="individual" className="bg-ground">Individual</option>
              <option value="group" className="bg-ground">Group</option>
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="size">Group size</label>
            <input
              id="size"
              type="number"
              min={2}
              disabled={form.work_mode !== "group"}
              className={`${fieldClass} mt-1 font-mono disabled:opacity-40`}
              value={form.group_size}
              onChange={(e) => setForm({ ...form, group_size: e.target.value })}
              placeholder="4"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="location">Location</label>
            <input
              id="location"
              className={`${fieldClass} mt-1`}
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Hall 2B"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="link">Submission link</label>
            <input
              id="link"
              type="url"
              className={`${fieldClass} mt-1 font-mono`}
              value={form.submission_link}
              onChange={(e) => setForm({ ...form, submission_link: e.target.value })}
              placeholder="https://…"
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              rows={2}
              className={`${fieldClass} mt-1 resize-none`}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Closed book. Calculator allowed."
            />
          </div>

          <DialogFooter className="sm:col-span-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg px-3 py-2 font-mono text-xs text-dim ring-1 ring-border transition-colors hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-ground ring-1 ring-cyan transition-opacity disabled:opacity-60"
            >
              {save.isPending ? "Saving…" : deadline ? "Save changes" : "Add to board"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
