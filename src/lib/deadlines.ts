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

/** Visual identity per event type — colours come from the design tokens. */
export type EventMeta = {
  label: string;
  /** tailwind colour name registered in styles.css */
  color: "evt-exam" | "evt-quiz" | "evt-assign" | "evt-present" | "evt-lecture";
  dot: string;
  text: string;
  chip: string;
  ring: string;
  bar: string;
};

const meta = (label: string, color: EventMeta["color"]): EventMeta => ({
  label,
  color,
  dot: `bg-${color}`,
  text: `text-${color}`,
  chip: `bg-${color}/12 text-${color} ring-1 ring-${color}/30`,
  ring: `ring-${color}/40`,
  bar: `bg-${color}`,
});

export const EVENT_META: Record<DeadlineType, EventMeta> = {
  midterm: meta("Midterm", "evt-exam"),
  endterm: meta("Endterm", "evt-exam"),
  quiz: meta("Quiz", "evt-quiz"),
  assignment: meta("Assignment", "evt-assign"),
  presentation: meta("Presentation", "evt-present"),
  guest_lecture: meta("Guest Lecture", "evt-lecture"),
  other: meta("Other", "evt-lecture"),
};

export function eventMeta(type: DeadlineType): EventMeta {
  return EVENT_META[type] ?? EVENT_META.other;
}

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
