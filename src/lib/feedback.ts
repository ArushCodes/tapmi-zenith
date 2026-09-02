import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Feedback = Tables<"feedback">;

export const FEEDBACK_KINDS = [
  { key: "bug", label: "Bug" },
  { key: "suggestion", label: "Suggestion" },
  { key: "feedback", label: "Feedback" },
  { key: "other", label: "Other" },
] as const;

export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]["key"];

export function feedbackQuery(userId: string | undefined) {
  return {
    queryKey: ["feedback", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Feedback[]> => {
      const { data, error } = await supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  };
}
