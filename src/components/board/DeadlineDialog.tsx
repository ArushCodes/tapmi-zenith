import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEADLINE_TYPES, type Deadline, type DeadlineType } from "@/lib/deadlines";
import { useBatch } from "@/hooks/use-batch";
import { coursesQuery, sessionsQuery } from "@/lib/batches";
import { isAcademicEvent } from "@/lib/courses";
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

const pad = (n: number) => String(n).padStart(2, "0");
const dateOf = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const timeOf = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** These deliverables must be attached to a real subject. */
const SUBJECT_REQUIRED: DeadlineType[] = [
  "quiz",
  "assignment",
  "presentation",
  "midterm",
  "endterm",
];

const emptyForm = {
  title: "",
  subject: "",
  type: "assignment" as DeadlineType,
  date: "",
  from: "",
  to: "",
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
  const { batchId } = useBatch();
  const { data: courses = [] } = useQuery(coursesQuery(batchId));
  const { data: sessions = [] } = useQuery(sessionsQuery(batchId));

  /** Every subject we know about: catalogued courses plus timetable classes. */
  const subjects = useMemo(() => {
    const set = new Set<string>();
    for (const c of courses) set.add(c.short_name || c.code);
    for (const s of sessions) {
      if (s.is_holiday || isAcademicEvent(s)) continue;
      const name = s.short_name ?? s.course_name;
      if (name) set.add(name);
    }
    if (deadline?.subject) set.add(deadline.subject);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [courses, sessions, deadline?.subject]);

  useEffect(() => {
    if (!open) return;
    if (deadline) {
      setForm({
        title: deadline.title,
        subject: deadline.subject,
        type: deadline.type,
        date: dateOf(deadline.due_at),
        from: deadline.all_day ? "" : timeOf(deadline.due_at),
        to: deadline.end_at ? timeOf(deadline.end_at) : "",
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
      const allDay = !form.from;
      const due = new Date(`${form.date}T${form.from || "00:00"}`);
      const end =
        !allDay && form.to ? new Date(`${form.date}T${form.to}`) : null;
      if (end && end.getTime() <= due.getTime()) throw new Error("End time must be after start");

      const payload = {
        title: form.title.trim(),
        subject: form.subject.trim(),
        subject_code: null,
        type: form.type,
        due_at: due.toISOString(),
        end_at: end ? end.toISOString() : null,
        all_day: allDay,
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

  const subjectRequired = SUBJECT_REQUIRED.includes(form.type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-border bg-surface2 text-ink">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-semibold tracking-tight">
            {deadline ? "Edit event" : "New event"}
          </DialogTitle>
        </DialogHeader>

        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.date) {
              toast.error("Pick a date");
              return;
            }
            if (subjectRequired && !form.subject) {
              toast.error("Pick the subject this belongs to");
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
            <label className={labelClass} htmlFor="subject">
              Subject{subjectRequired ? " (required)" : " (optional)"}
            </label>
            <select
              id="subject"
              className={`${fieldClass} mt-1`}
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            >
              <option value="" className="bg-ground">
                {subjectRequired ? "Select a subject…" : "No subject"}
              </option>
              {subjects.map((s) => (
                <option key={s} value={s} className="bg-ground">
                  {s}
                </option>
              ))}
            </select>
            {subjects.length === 0 && (
              <p className="mt-1 font-mono text-[10px] text-faint">
                Sync the timetable to populate subjects.
              </p>
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor="date">Date</label>
            <input
              id="date"
              type="date"
              required
              className={`${fieldClass} mt-1 font-mono`}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="from">From (optional)</label>
              <input
                id="from"
                type="time"
                className={`${fieldClass} mt-1 font-mono`}
                value={form.from}
                onChange={(e) =>
                  setForm({ ...form, from: e.target.value, to: e.target.value ? form.to : "" })
                }
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="to">To</label>
              <input
                id="to"
                type="time"
                disabled={!form.from}
                className={`${fieldClass} mt-1 font-mono disabled:opacity-40`}
                value={form.to}
                onChange={(e) => setForm({ ...form, to: e.target.value })}
              />
            </div>
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

          <div className="sm:col-span-2">
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
