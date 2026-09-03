import { db as supabase } from "@/lib/backend";
import type { Tables } from "@/integrations/supabase/types";

export type DayMark = Tables<"batch_day_marks">;

/** Moderator-picked day colours. Kept as literal hex so they can be stored,
 *  round-tripped and rendered as inline tints without a Tailwind safelist. */
export const DAY_COLORS: { value: string; label: string }[] = [
  { value: "#22d3ee", label: "Cyan" },
  { value: "#a78bfa", label: "Violet" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#f43f5e", label: "Rose" },
  { value: "#34d399", label: "Green" },
  { value: "#60a5fa", label: "Blue" },
  { value: "#f472b6", label: "Pink" },
  { value: "#94a3b8", label: "Slate" },
];

export function dayMarksQuery(batchId: string | null) {
  return {
    queryKey: ["day-marks", batchId],
    enabled: !!batchId,
    queryFn: async (): Promise<DayMark[]> => {
      const { data, error } = await supabase
        .from("batch_day_marks")
        .select("*")
        .eq("batch_id", batchId!)
        .order("day", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  };
}

/** Marks keyed by YYYY-MM-DD so calendar cells can look them up directly. */
export function dayMarkMap(marks: DayMark[]) {
  return new Map(marks.map((m) => [m.day, m]));
}

/** Soft background tint for a day cell from its mark colour. */
export function markTint(color: string) {
  return { backgroundColor: `${color}1f`, boxShadow: `inset 0 0 0 1px ${color}59` };
}
