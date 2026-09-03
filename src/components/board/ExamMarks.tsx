import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, Percent, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { db as supabase } from "@/lib/backend";
import { useAuth } from "@/hooks/use-auth";
import { useBatch } from "@/hooks/use-batch";
import { examMarksQuery, fmtNum, scorePct, weightedPoints } from "@/lib/marks";
import type { Deadline } from "@/lib/deadlines";

/** Personal marks entry for one exam: score / total / weightage → percentage. */
export function ExamMarks({ deadline }: { deadline: Deadline }) {
  const { batchId, isMember } = useBatch();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: marks = [] } = useQuery(examMarksQuery(batchId, user?.id));
  const mine = marks.find((m) => m.deadline_id === deadline.id) ?? null;

  const [score, setScore] = useState("");
  const [total, setTotal] = useState("");
  const [weightage, setWeightage] = useState("");

  useEffect(() => {
    setScore(mine ? fmtNum(Number(mine.score)) : "");
    setTotal(mine ? fmtNum(Number(mine.total)) : "");
    setWeightage(mine ? fmtNum(Number(mine.weightage)) : "");
  }, [mine?.id, mine?.score, mine?.total, mine?.weightage]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["exam-marks", batchId, user?.id] });

  const save = useMutation({
    mutationFn: async () => {
      const s = Number(score);
      const t = Number(total);
      const w = weightage === "" ? 0 : Number(weightage);
      if (!Number.isFinite(s) || !Number.isFinite(t) || t <= 0)
        throw new Error("Enter a score and a total out of which it was marked.");
      if (s < 0 || s > t) throw new Error("Score has to be between 0 and the total.");
      const { error } = await supabase.from("exam_marks").upsert(
        {
          deadline_id: deadline.id,
          batch_id: deadline.batch_id,
          user_id: user!.id,
          score: s,
          total: t,
          weightage: w,
        },
        { onConflict: "deadline_id,user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Marks saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("exam_marks").delete().eq("id", mine!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Marks removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isMember || !user) return null;

  const s = Number(score);
  const t = Number(total);
  const w = weightage === "" ? 0 : Number(weightage);
  const valid = Number.isFinite(s) && Number.isFinite(t) && t > 0 && s >= 0 && s <= t;
  const pct = valid ? scorePct(s, t) : null;
  const points = valid && w > 0 ? weightedPoints(s, t, w) : null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-surface2/60 px-3 py-2 ring-1 ring-border">
      <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
        <Percent className="size-3" /> My marks
      </span>

      <Field value={score} onChange={setScore} placeholder="Scored" width="w-16" />
      <span className="font-mono text-[11px] text-faint">/</span>
      <Field value={total} onChange={setTotal} placeholder="Out of" width="w-16" />
      <Field value={weightage} onChange={setWeightage} placeholder="Weight %" width="w-20" />

      <div className="ml-auto flex items-center gap-2">
        {pct !== null && (
          <span className="rounded-lg bg-cyan/12 px-2 py-1 font-mono text-[11px] tabular-nums text-cyan ring-1 ring-cyan/30">
            {pct}%
            {points !== null ? ` · ${points}/${fmtNum(w)} of course` : ""}
          </span>
        )}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => save.mutate()}
          disabled={!valid || save.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-cyan/15 px-2.5 py-1.5 font-mono text-[10px] text-cyan ring-1 ring-cyan/40 disabled:opacity-40"
        >
          <Check className="size-3.5" /> Save
        </motion.button>
        {mine && (
          <button
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            title="Remove these marks"
            className="flex items-center rounded-lg px-2 py-1.5 text-dim ring-1 ring-border hover:text-evt-exam disabled:opacity-40"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  value,
  onChange,
  placeholder,
  width,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  width: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
      inputMode="decimal"
      placeholder={placeholder}
      className={`${width} rounded-lg bg-surface px-2 py-1.5 font-mono text-[11px] tabular-nums text-ink outline-none ring-1 ring-border placeholder:text-faint focus:ring-cyan/40`}
    />
  );
}
