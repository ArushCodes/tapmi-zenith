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
  { value: "guest_lecture", label: "Guest Lecture" },
  { value: "other", label: "Other" },
];

export const FILTERS = [
  { key: "all", label: "All", types: null },
  { key: "quiz", label: "Quizzes", types: ["quiz"] },
  { key: "assignment", label: "Assignments", types: ["assignment"] },
  { key: "presentation", label: "Presentations", types: ["presentation"] },
  { key: "exam", label: "Midterms / Endterms", types: ["midterm", "endterm"] },
  { key: "lecture", label: "Lectures / Other", types: ["guest_lecture", "other"] },
] as const;

export type FilterKey = (typeof FILTERS)[number]["key"];

/** Visual identity per event type — colours come from the design tokens.
 *  Class strings are written literally so Tailwind can see them. */
export type EventMeta = {
  label: string;
  dot: string;
  text: string;
  chip: string;
  ring: string;
  bar: string;
  glow: string;
};

const EXAM: Omit<EventMeta, "label"> = {
  dot: "bg-evt-exam",
  text: "text-evt-exam",
  chip: "bg-evt-exam/12 text-evt-exam ring-1 ring-evt-exam/30",
  ring: "ring-evt-exam/40",
  bar: "bg-evt-exam",
  glow: "shadow-[0_0_18px_-6px_var(--evt-exam)]",
};
const QUIZ: Omit<EventMeta, "label"> = {
  dot: "bg-evt-quiz",
  text: "text-evt-quiz",
  chip: "bg-evt-quiz/12 text-evt-quiz ring-1 ring-evt-quiz/30",
  ring: "ring-evt-quiz/40",
  bar: "bg-evt-quiz",
  glow: "shadow-[0_0_18px_-6px_var(--evt-quiz)]",
};
const ASSIGN: Omit<EventMeta, "label"> = {
  dot: "bg-evt-assign",
  text: "text-evt-assign",
  chip: "bg-evt-assign/12 text-evt-assign ring-1 ring-evt-assign/30",
  ring: "ring-evt-assign/40",
  bar: "bg-evt-assign",
  glow: "shadow-[0_0_18px_-6px_var(--evt-assign)]",
};
const PRESENT: Omit<EventMeta, "label"> = {
  dot: "bg-evt-present",
  text: "text-evt-present",
  chip: "bg-evt-present/12 text-evt-present ring-1 ring-evt-present/30",
  ring: "ring-evt-present/40",
  bar: "bg-evt-present",
  glow: "shadow-[0_0_18px_-6px_var(--evt-present)]",
};
const LECTURE: Omit<EventMeta, "label"> = {
  dot: "bg-evt-lecture",
  text: "text-evt-lecture",
  chip: "bg-evt-lecture/12 text-evt-lecture ring-1 ring-evt-lecture/30",
  ring: "ring-evt-lecture/40",
  bar: "bg-evt-lecture",
  glow: "shadow-[0_0_18px_-6px_var(--evt-lecture)]",
};

export const EVENT_META: Record<DeadlineType, EventMeta> = {
  midterm: { label: "Midterm", ...EXAM },
  endterm: { label: "Endterm", ...EXAM },
  quiz: { label: "Quiz", ...QUIZ },
  assignment: { label: "Assignment", ...ASSIGN },
  presentation: { label: "Presentation", ...PRESENT },
  guest_lecture: { label: "Guest Lecture", ...LECTURE },
  other: { label: "Other", ...LECTURE },
};

export function eventMeta(type: DeadlineType): EventMeta {
  return EVENT_META[type] ?? EVENT_META.other;
}

export function deadlinesQueryFor(batchId: string | null) {
  return {
    queryKey: ["deadlines", batchId],
    enabled: !!batchId,
    queryFn: async (): Promise<Deadline[]> => {
      const { data, error } = await supabase
        .from("deadlines")
        .select("*")
        .eq("batch_id", batchId!)
        .order("due_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  };
}

export function typeLabel(type: DeadlineType) {
  return eventMeta(type).label;
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
  const totalMin = Math.floor(diff / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days >= 1) return `${days}d ${hours}h ${mins}m`;
  if (hours >= 1) return `${hours}h ${mins}m`;
  return `${mins}m`;
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

const dayOnlyFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
});
const clockFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Date column copy — the clock only shows when a time was actually set. */
export function formatDeadlineWhen(d: Deadline) {
  const start = new Date(d.due_at);
  const day = dayOnlyFmt.format(start);
  if (d.all_day) return day;
  const from = clockFmt.format(start);
  if (d.end_at) return `${day}, ${from}–${clockFmt.format(new Date(d.end_at))}`;
  return `${day}, ${from}`;
}

export function deadlineEndMs(d: Deadline) {
  if (d.end_at) return new Date(d.end_at).getTime();
  if (d.all_day) {
    const e = new Date(d.due_at);
    e.setHours(23, 59, 59, 999);
    return e.getTime();
  }
  return new Date(d.due_at).getTime();
}

export type Phase = "ongoing" | "upcoming" | "completed";

/** Ongoing = started but its window hasn't closed. Completed = window closed. */
export function phaseOf(d: Deadline, now: number): Phase {
  const start = new Date(d.due_at).getTime();
  const end = deadlineEndMs(d);
  if (now > end) return "completed";
  if (now >= start && end > start) return "ongoing";
  return "upcoming";
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

export function dayKey(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function matchesSearch(d: Deadline, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [d.title, d.subject, d.subject_code, d.location, d.notes]
    .filter(Boolean)
    .some((v) => v!.toLowerCase().includes(q));
}

export function filterByKey(list: Deadline[], key: FilterKey, search: string) {
  const active = FILTERS.find((f) => f.key === key);
  return list.filter((d) => {
    if (active?.types && !(active.types as readonly string[]).includes(d.type)) return false;
    return matchesSearch(d, search);
  });
}

/* ---------- calendar export helpers ---------- */

function toUtcStamp(date: Date) {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

export function eventEnd(d: Deadline) {
  return new Date(new Date(d.due_at).getTime() + 60 * 60_000);
}

export function eventTitle(d: Deadline) {
  return `${d.subject_code ? `${d.subject_code} · ` : ""}${d.title}`;
}

export function googleCalendarUrl(d: Deadline) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: eventTitle(d),
    dates: `${toUtcStamp(new Date(d.due_at))}/${toUtcStamp(eventEnd(d))}`,
    details: [d.subject, typeLabel(d.type), d.notes, d.submission_link].filter(Boolean).join("\n"),
    location: d.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function icsFor(d: Deadline) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TAPMI IPM Deadline Board//EN",
    "BEGIN:VEVENT",
    `UID:${d.id}@tapmi-ipm`,
    `DTSTAMP:${toUtcStamp(new Date())}`,
    `DTSTART:${toUtcStamp(new Date(d.due_at))}`,
    `DTEND:${toUtcStamp(eventEnd(d))}`,
    `SUMMARY:${eventTitle(d)}`,
    `DESCRIPTION:${[d.subject, typeLabel(d.type), d.notes].filter(Boolean).join(" — ")}`,
    `LOCATION:${d.location ?? ""}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(d: Deadline) {
  const blob = new Blob([icsFor(d)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${eventTitle(d).replace(/[^\w\- ]+/g, "")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
