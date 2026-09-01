import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Deadline = Tables<"deadlines">;
export type DeadlineType = Deadline["type"];

export const DEADLINE_TYPES: { value: DeadlineType; label: string }[] = [
  { value: "quiz", label: "Quiz" },
  { value: "assignment", label: "Assignment" },
  { value: "presentation", label: "Presentation" },
  { value: "midterm", label: "Midterm" },
  { value: "endterm", label: "Endterm" },
];

export const FILTERS = [
  { key: "all", label: "All", types: null },
  { key: "quiz", label: "Quizzes", types: ["quiz"] },
  { key: "assignment", label: "Assignments", types: ["assignment"] },
  { key: "presentation", label: "Presentations", types: ["presentation"] },
  { key: "exam", label: "Midterms / Endterms", types: ["midterm", "endterm"] },
] as const;

export type FilterKey = (typeof FILTERS)[number]["key"];

export const deadlinesQuery = {
  queryKey: ["deadlines"],
  queryFn: async (): Promise<Deadline[]> => {
    const { data, error } = await supabase
      .from("deadlines")
      .select("*")
      .order("due_at", { ascending: true });
    if (error) throw error;
    return data;
  },
};

export function typeLabel(type: DeadlineType) {
  return DEADLINE_TYPES.find((t) => t.value === type)?.label ?? type;
}

export type Urgency = "past" | "critical" | "soon" | "later";

export function urgencyOf(dueAt: string, now: number): Urgency {
  const diff = new Date(dueAt).getTime() - now;
  if (diff <= 0) return "past";
  if (diff < 24 * 3600_000) return "critical";
  if (diff < 72 * 3600_000) return "soon";
  return "later";
}

export function timeLeft(dueAt: string, now: number) {
  const diff = new Date(dueAt).getTime() - now;
  if (diff <= 0) return "Closed";
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days >= 1) return `${days}d ${String(hours).padStart(2, "0")}h`;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatDue(dueAt: string) {
  return dateFmt.format(new Date(dueAt));
}

export function weekKey(dueAt: string) {
  const d = new Date(dueAt);
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

export function formatWeek(iso: string) {
  const start = new Date(iso);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const f = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });
  return `${f.format(start)} — ${f.format(end)}`;
}
