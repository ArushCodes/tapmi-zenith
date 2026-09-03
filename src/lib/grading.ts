import { db as supabase } from "@/lib/backend";
import type { Tables } from "@/integrations/supabase/types";

export type CourseComponent = Tables<"course_components">;
export type ComponentMark = Tables<"component_marks">;

/** Pass rule: you need 40% overall AND 40% in the End-Term, separately. */
export const PASS_LINE = 40;

export function courseComponentsQuery(batchId: string | null) {
  return {
    queryKey: ["course-components", batchId],
    enabled: !!batchId,
    queryFn: async (): Promise<CourseComponent[]> => {
      const { data, error } = await supabase
        .from("course_components")
        .select("*")
        .eq("batch_id", batchId!)
        .order("course_name", { ascending: true })
        .order("sequence", { ascending: true });
      if (error) throw error;
      return data;
    },
  };
}

export function componentMarksQuery(batchId: string | null, userId: string | undefined) {
  return {
    queryKey: ["component-marks", batchId, userId],
    enabled: !!batchId && !!userId,
    queryFn: async (): Promise<ComponentMark[]> => {
      const { data, error } = await supabase
        .from("component_marks")
        .select("*")
        .eq("batch_id", batchId!)
        .eq("user_id", userId!);
      if (error) throw error;
      return data;
    },
  };
}

/** Plain-English label for each grading component type. */
export const KIND_LABEL: Record<string, string> = {
  endterm: "End-term exam",
  midterm: "Mid-term exam",
  quiz: "Quiz",
  project: "Project",
  presentation: "Presentation",
  assignment: "Assignment",
  participation: "Class participation",
  exam: "Exam",
  other: "Other",
};

/** Marks out of this component's weightage that a score actually earned. */
export function earnedPoints(score: number, total: number, weightage: number) {
  if (!total) return 0;
  return Math.round((score / total) * weightage * 10) / 10;
}

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export type CourseRow = {
  code: string;
  name: string;
  credits: number;
  isMlc: boolean;
  isProvisional: boolean;
  components: Array<{
    component: CourseComponent;
    mark: ComponentMark | null;
    pct: number | null;
    earned: number | null;
  }>;
  /** Weightage total the components add up to — should be 100. */
  weightSum: number;
  /** Weightage covered by components you have entered marks for. */
  gradedWeight: number;
  /** Marks banked so far, out of 100. */
  banked: number;
  /** Score across only what has been graded — your current standing. */
  runningPct: number | null;
  /** Final score if everything left is scored at your current rate. */
  projected: number | null;
  /** Best possible final score if you ace everything remaining. */
  bestCase: number;
  /** End-term percentage, when it has been entered. */
  endTermPct: number | null;
  overallAtRisk: boolean;
  endTermAtRisk: boolean;
};

/** Groups components by course and works out where each course stands. */
export function buildCourseRows(
  components: CourseComponent[],
  marks: ComponentMark[],
): CourseRow[] {
  const byId = new Map(marks.map((m) => [m.component_id, m]));
  const groups = new Map<string, CourseComponent[]>();
  for (const c of components) {
    const list = groups.get(c.course_code);
    if (list) list.push(c);
    else groups.set(c.course_code, [c]);
  }

  const rows: CourseRow[] = [];
  for (const [code, list] of groups) {
    const sorted = [...list].sort((a, b) => a.sequence - b.sequence);
    const head = sorted[0]!;
    let weightSum = 0;
    let gradedWeight = 0;
    let banked = 0;
    let endTermPct: number | null = null;

    const rowComponents = sorted.map((component) => {
      const weightage = Number(component.weightage);
      weightSum += weightage;
      const mark = byId.get(component.id) ?? null;
      const total = mark ? Number(mark.total) : 0;
      const score = mark ? Number(mark.score) : 0;
      const pct = mark && total > 0 ? round1((score / total) * 100) : null;
      const earned = pct === null ? null : earnedPoints(score, total, weightage);
      if (earned !== null) {
        gradedWeight += weightage;
        banked += earned;
        if (component.kind === "endterm") endTermPct = pct;
      }
      return { component, mark, pct, earned };
    });

    const runningPct = gradedWeight > 0 ? round1((banked / gradedWeight) * 100) : null;
    const remaining = Math.max(0, weightSum - gradedWeight);
    const projected =
      runningPct === null ? null : round1(banked + (remaining * runningPct) / 100);

    rows.push({
      code,
      name: head.course_name,
      credits: Number(head.credits),
      isMlc: head.is_mlc,
      isProvisional: head.is_provisional,
      components: rowComponents,
      weightSum: round1(weightSum),
      gradedWeight: round1(gradedWeight),
      banked: round1(banked),
      runningPct,
      projected,
      bestCase: round1(banked + remaining),
      endTermPct,
      overallAtRisk: !head.is_mlc && projected !== null && projected < PASS_LINE,
      endTermAtRisk: !head.is_mlc && endTermPct !== null && endTermPct < PASS_LINE,
    });
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}
