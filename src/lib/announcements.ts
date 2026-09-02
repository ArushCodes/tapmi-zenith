import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Announcement = Tables<"announcements">;

export function announcementsQuery(batchId: string | null) {
  return {
    queryKey: ["announcements", batchId],
    enabled: !!batchId,
    queryFn: async (): Promise<Announcement[]> => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("batch_id", batchId!)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  };
}

const rel = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

export function timeAgo(iso: string, now = Date.now()) {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const min = 60_000;
  if (abs < min) return "just now";
  if (abs < 60 * min) return rel.format(Math.round(diff / min), "minute");
  if (abs < 24 * 60 * min) return rel.format(Math.round(diff / (60 * min)), "hour");
  return rel.format(Math.round(diff / (24 * 60 * min)), "day");
}
