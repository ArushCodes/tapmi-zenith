import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { db as supabase } from "@/lib/backend";
import { useAuth } from "@/hooks/use-auth";
import { useBatch } from "@/hooks/use-batch";
import {
  KIND_LABEL,
  PASS_LINE,
  buildCourseRows,
  componentMarksQuery,
  courseComponentsQuery,
  earnedPoints,
  round1,
  type CourseComponent,
  type CourseRow,
} from "@/lib/grading";

const KINDS = Object.keys(KIND_LABEL);

/** Per-course grading breakdown: what each piece of work is worth, what you
 *  scored on it, and where the course as a whole is heading. */
export function GradingPanel() {
  const { batchId, isMember, canManage } = useBatch();
  const { user } = useAuth();
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<CourseComponent> | null>(null);

  const { data: components = [], isLoading } = useQuery(courseComponentsQuery(batchId));
  const { data: marks = [] } = useQuery(componentMarksQuery(batchId, user?.id));

  const rows = useMemo(() => buildCourseRows(components, marks), [components, marks]);

  if (!isMember)
    return (
      <p className="mt-10 text-center font-mono text-xs text-faint">
        Grading is visible to approved batch members.
      </p>
    );

  return (
    <section className="mt-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
          Grading &amp; weightage
        </p>
        {canManage && (
          <button
            onClick={() =>
              setEditing({ batch_id: batchId!, weightage: 10, kind: "quiz", sequence: 0 })
            }
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-surface2 px-2.5 py-1.5 font-mono text-[11px] text-dim ring-1 ring-border hover:text-ink"
          >
            <Plus className="size-3.5" /> Add component
          </button>
        )}
      </div>

      <PassRuleCard />

      {isLoading && (
        <p className="mt-6 text-center font-mono text-xs text-faint">Loading courses…</p>
      )}

      {!isLoading && rows.length === 0 && (
        <p className="mt-6 text-center font-mono text-xs text-faint">
          No grading breakdown has been added for this batch yet.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {rows.map((row) => (
          <CourseCard
            key={row.code}
            row={row}
            open={open === row.code}
            onToggle={() => setOpen(open === row.code ? null : row.code)}
            canManage={canManage}
            onEdit={(c) => setEditing(c)}
            batchId={batchId!}
            userId={user?.id}
          />
        ))}
      </div>

      {editing && (
        <ComponentDialog
          draft={editing}
          courses={rows}
          onClose={() => setEditing(null)}
          batchId={batchId!}
        />
      )}
    </section>
  );
}

/** The 40% rule, spelled out. */
function PassRuleCard() {
  return (
    <div className="rounded-2xl bg-surface p-4 ring-1 ring-border">
      <p className="font-display text-sm font-semibold text-ink">How a course score is built</p>
      <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-dim">
        Every course is split into pieces of work — exams, quizzes, projects, class participation —
        and each one is worth a share of 100 marks. Enter what you scored and this page adds it up
        for you.
      </p>
      <p className="mt-2 font-mono text-[11px] leading-relaxed text-dim">
        To pass you need <span className="text-ink">{PASS_LINE}% overall</span> and, separately,{" "}
        <span className="text-ink">{PASS_LINE}% in the end-term exam</span>. Miss either one and the
        course is a fail, no matter how good the other number looks.
      </p>
    </div>
  );
}

function CourseCard({
  row,
  open,
  onToggle,
  canManage,
  onEdit,
  batchId,
  userId,
}: {
  row: CourseRow;
  open: boolean;
  onToggle: () => void;
  canManage: boolean;
  onEdit: (c: Partial<CourseComponent>) => void;
  batchId: string;
  userId: string | undefined;
}) {
  const headline = row.projected ?? null;
  const tone =
    row.overallAtRisk || row.endTermAtRisk
      ? "text-rose"
      : headline === null
        ? "text-faint"
        : headline >= 70
          ? "text-evt-present"
          : "text-amber";

  return (
    <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-border">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-surface2/40"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-sm font-semibold">{row.name}</span>
            <span className="font-mono text-[10px] text-faint">{row.code}</span>
            <span className="rounded-md px-1.5 py-0.5 font-mono text-[9px] text-dim ring-1 ring-border">
              {row.credits} {row.credits === 1 ? "credit" : "credits"}
            </span>
            {row.isMlc && (
              <span className="rounded-md bg-violet/12 px-1.5 py-0.5 font-mono text-[9px] text-violet ring-1 ring-violet/30">
                Pass / fail only — no CGPA
              </span>
            )}
            {row.isProvisional && (
              <span className="rounded-md bg-amber/12 px-1.5 py-0.5 font-mono text-[9px] text-amber ring-1 ring-amber/30">
                Provisional split
              </span>
            )}
          </span>
          <span className="mt-1 block font-mono text-[10px] text-faint">
            {row.gradedWeight > 0
              ? `${row.banked} marks banked from ${row.gradedWeight}% of the course · best possible ${row.bestCase}`
              : "Nothing graded yet — add a score below to see where you stand"}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className={`block font-display text-lg font-semibold leading-none ${tone}`}>
            {headline === null ? "—" : `${headline}%`}
          </span>
          <span className="mt-1 block font-mono text-[9px] text-faint">
            {headline === null ? "no marks yet" : "projected final"}
          </span>
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {(row.overallAtRisk || row.endTermAtRisk || round1(row.weightSum) !== 100) && (
        <div className="flex flex-col gap-1 border-t border-border px-4 py-2">
          {row.endTermAtRisk && (
            <Warning>
              Your end-term is under {PASS_LINE}% — that alone fails the course, even with a good
              overall score.
            </Warning>
          )}
          {row.overallAtRisk && (
            <Warning>
              At this rate the course lands under {PASS_LINE}% overall, which is a fail.
            </Warning>
          )}
          {round1(row.weightSum) !== 100 && (
            <Warning>
              These components add up to {row.weightSum}%, not 100% — the breakdown is incomplete.
            </Warning>
          )}
        </div>
      )}

      {open && (
        <div className="border-t border-border">
          {row.components.map((c) => (
            <Fragment key={c.component.id}>
              <ComponentRow
                component={c.component}
                pct={c.pct}
                earned={c.earned}
                markId={c.mark?.id ?? null}
                score={c.mark ? Number(c.mark.score) : null}
                total={c.mark ? Number(c.mark.total) : null}
                canManage={canManage}
                onEdit={() => onEdit(c.component)}
                batchId={batchId}
                userId={userId}
              />
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 font-mono text-[10px] leading-relaxed text-rose">
      <AlertTriangle className="mt-px size-3 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function ComponentRow({
  component,
  pct,
  earned,
  markId,
  score,
  total,
  canManage,
  onEdit,
  batchId,
  userId,
}: {
  component: CourseComponent;
  pct: number | null;
  earned: number | null;
  markId: string | null;
  score: number | null;
  total: number | null;
  canManage: boolean;
  onEdit: () => void;
  batchId: string;
  userId: string | undefined;
}) {
  const queryClient = useQueryClient();
  const [s, setS] = useState(score === null ? "" : String(score));
  const [t, setT] = useState(total === null ? "" : String(total));

  useEffect(() => {
    setS(score === null ? "" : String(score));
    setT(total === null ? "" : String(total));
  }, [score, total, markId]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["component-marks", batchId, userId] });

  const save = useMutation({
    mutationFn: async () => {
      const ns = Number(s);
      const nt = Number(t);
      if (!Number.isFinite(ns) || !Number.isFinite(nt) || nt <= 0)
        throw new Error("Enter your score and the total it was marked out of.");
      if (ns < 0 || ns > nt) throw new Error("Score has to be between 0 and the total.");
      const { error } = await supabase.from("component_marks").upsert(
        { component_id: component.id, batch_id: batchId, user_id: userId!, score: ns, total: nt },
        { onConflict: "component_id,user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Marks saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clear = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("component_marks").delete().eq("id", markId!);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Marks cleared");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const weightage = Number(component.weightage);
  const preview =
    Number(t) > 0 && Number.isFinite(Number(s))
      ? earnedPoints(Number(s), Number(t), weightage)
      : null;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[13px] font-semibold">
          {component.name}
        </span>
        <span className="mt-0.5 block font-mono text-[10px] text-faint">
          Worth {weightage}% · {KIND_LABEL[component.kind] ?? component.kind} ·{" "}
          {component.work_mode === "group" ? "group" : "individual"}
          {component.timing_note ? ` · ${component.timing_note}` : ""}
        </span>
      </span>

      <span className="flex items-center gap-1.5">
        <input
          value={s}
          onChange={(e) => setS(e.target.value)}
          placeholder="score"
          inputMode="decimal"
          className="w-16 rounded-lg bg-surface2 px-2 py-1 text-center font-mono text-[11px] text-ink ring-1 ring-border outline-none focus:ring-cyan"
        />
        <span className="font-mono text-[10px] text-faint">/</span>
        <input
          value={t}
          onChange={(e) => setT(e.target.value)}
          placeholder="out of"
          inputMode="decimal"
          className="w-16 rounded-lg bg-surface2 px-2 py-1 text-center font-mono text-[11px] text-ink ring-1 ring-border outline-none focus:ring-cyan"
        />
        <button
          onClick={() => save.mutate()}
          className="rounded-lg bg-cyan px-2.5 py-1 font-mono text-[11px] text-primary-foreground hover:opacity-90"
        >
          Save
        </button>
        {markId && (
          <button
            onClick={() => clear.mutate()}
            title="Clear my marks"
            className="rounded-lg p-1.5 text-faint ring-1 ring-border hover:text-rose"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
        {canManage && (
          <button
            onClick={onEdit}
            title="Edit this component"
            className="rounded-lg p-1.5 text-faint ring-1 ring-border hover:text-ink"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </span>

      <span className="w-full font-mono text-[10px] text-dim sm:w-auto sm:min-w-[140px] sm:text-right">
        {pct === null && preview === null
          ? "Not graded yet"
          : `${pct ?? round1((Number(s) / Number(t)) * 100)}% on the paper → ${
              earned ?? preview
            } of ${weightage} marks`}
      </span>
    </div>
  );
}

/** Moderator editor for one grading component. */
function ComponentDialog({
  draft,
  courses,
  onClose,
  batchId,
}: {
  draft: Partial<CourseComponent>;
  courses: CourseRow[];
  onClose: () => void;
  batchId: string;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    course_code: draft.course_code ?? courses[0]?.code ?? "",
    course_name: draft.course_name ?? courses[0]?.name ?? "",
    credits: String(draft.credits ?? courses[0]?.credits ?? 3),
    name: draft.name ?? "",
    weightage: String(draft.weightage ?? 10),
    kind: draft.kind ?? "quiz",
    sequence: String(draft.sequence ?? 0),
    timing_note: draft.timing_note ?? "",
    work_mode: draft.work_mode ?? "individual",
    is_mlc: draft.is_mlc ?? false,
    is_provisional: draft.is_provisional ?? false,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["course-components", batchId] });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.course_code.trim() || !form.course_name.trim() || !form.name.trim())
        throw new Error("Course code, course name and component name are all required.");
      const payload = {
        batch_id: batchId,
        course_code: form.course_code.trim(),
        course_name: form.course_name.trim(),
        credits: Number(form.credits) || 0,
        name: form.name.trim(),
        weightage: Number(form.weightage) || 0,
        kind: form.kind as CourseComponent["kind"],
        sequence: Number(form.sequence) || 0,
        timing_note: form.timing_note.trim() || null,
        work_mode: form.work_mode as CourseComponent["work_mode"],
        is_mlc: form.is_mlc,
        is_provisional: form.is_provisional,
      };
      const { error } = draft.id
        ? await supabase.from("course_components").update(payload).eq("id", draft.id)
        : await supabase.from("course_components").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Saved");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("course_components").delete().eq("id", draft.id!);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Component removed");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const field = "w-full rounded-lg bg-surface2 px-2.5 py-1.5 font-mono text-[11px] text-ink ring-1 ring-border outline-none focus:ring-cyan";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 sm:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-surface p-4 ring-1 ring-border"
      >
        <p className="font-display text-sm font-semibold text-ink">
          {draft.id ? "Edit component" : "Add component"}
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] text-faint">Course code</span>
            <input
              className={field}
              value={form.course_code}
              onChange={(e) => setForm({ ...form, course_code: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] text-faint">Course name</span>
            <input
              className={field}
              value={form.course_name}
              onChange={(e) => setForm({ ...form, course_name: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] text-faint">Credits</span>
            <input
              className={field}
              value={form.credits}
              onChange={(e) => setForm({ ...form, credits: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] text-faint">Component name</span>
            <input
              className={field}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] text-faint">Weightage %</span>
            <input
              className={field}
              value={form.weightage}
              onChange={(e) => setForm({ ...form, weightage: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] text-faint">Type</span>
            <select
              className={field}
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as typeof form.kind })}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] text-faint">Individual or group</span>
            <select
              className={field}
              value={form.work_mode}
              onChange={(e) =>
                setForm({ ...form, work_mode: e.target.value as typeof form.work_mode })
              }
            >
              <option value="individual">Individual</option>
              <option value="group">Group</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] text-faint">Order</span>
            <input
              className={field}
              value={form.sequence}
              onChange={(e) => setForm({ ...form, sequence: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="font-mono text-[10px] text-faint">When it happens</span>
            <input
              className={field}
              value={form.timing_note}
              onChange={(e) => setForm({ ...form, timing_note: e.target.value })}
              placeholder="e.g. after session 10"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 font-mono text-[10px] text-dim">
            <input
              type="checkbox"
              checked={form.is_mlc}
              onChange={(e) => setForm({ ...form, is_mlc: e.target.checked })}
            />
            Pass / fail course, no CGPA
          </label>
          <label className="flex items-center gap-1.5 font-mono text-[10px] text-dim">
            <input
              type="checkbox"
              checked={form.is_provisional}
              onChange={(e) => setForm({ ...form, is_provisional: e.target.checked })}
            />
            Provisional split
          </label>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => save.mutate()}
            className="rounded-lg bg-cyan px-3 py-1.5 font-mono text-[11px] text-primary-foreground hover:opacity-90"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 font-mono text-[11px] text-dim ring-1 ring-border hover:text-ink"
          >
            Cancel
          </button>
          {draft.id && (
            <button
              onClick={() => remove.mutate()}
              className="ml-auto rounded-lg px-3 py-1.5 font-mono text-[11px] text-rose ring-1 ring-rose/30 hover:bg-rose/10"
            >
              Delete
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
