import { db as supabase } from "@/lib/backend";
import type { Tables } from "@/integrations/supabase/types";

export type ExamMark = Tables<"exam_marks">;

/** My own marks for this batch — one row per exam at most. */
export function examMarksQuery(batchId: string | null, userId: string | undefined) {
  return {
    queryKey: ["exam-marks", batchId, userId],
    enabled: !!batchId && !!userId,
    queryFn: async (): Promise<ExamMark[]> => {
      const { data, error } = await supabase
        .from("exam_marks")
        .select("*")
        .eq("batch_id", batchId!)
        .eq("user_id", userId!);
      if (error) throw error;
      return data;
    },
  };
}

/** Percentage scored on the paper itself. */
export function scorePct(score: number, total: number) {
  if (!total) return 0;
  return Math.round((score / total) * 1000) / 10;
}

/** How many of the course's weightage points this score actually earned. */
export function weightedPoints(score: number, total: number, weightage: number) {
  if (!total) return 0;
  return Math.round((score / total) * weightage * 10) / 10;
}

export function fmtNum(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
