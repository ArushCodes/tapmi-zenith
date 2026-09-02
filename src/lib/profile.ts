import { db as supabase } from "@/lib/backend";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;

/** Fields a student may change themselves. Everything else is locked server-side. */
export type EditableProfile = {
  full_name: string;
  display_name: string;
  pronouns: string;
  phone: string;
  section: string;
  timezone: string;
  bio: string;
  avatar_url: string;
  github_url: string;
  linkedin_url: string;
  website_url: string;
  notify_email: boolean;
  reminder_hours: number;
};

export const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "UTC",
];

export function profileQuery(userId: string | undefined) {
  return {
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  };
}

export function toEditable(p: Profile | null | undefined): EditableProfile {
  return {
    full_name: p?.full_name ?? "",
    display_name: p?.display_name ?? "",
    pronouns: p?.pronouns ?? "",
    phone: p?.phone ?? "",
    section: p?.section ?? "",
    timezone: p?.timezone ?? "Asia/Kolkata",
    bio: p?.bio ?? "",
    avatar_url: p?.avatar_url ?? "",
    github_url: p?.github_url ?? "",
    linkedin_url: p?.linkedin_url ?? "",
    website_url: p?.website_url ?? "",
    notify_email: p?.notify_email ?? true,
    reminder_hours: p?.reminder_hours ?? 24,
  };
}

export function initialsOf(name: string | null | undefined, fallback = "MA") {
  const parts = (name ?? "").split(/[\s@._-]+/).filter(Boolean).slice(0, 2);
  const out = parts.map((s) => s[0]?.toUpperCase()).join("");
  return out || fallback;
}

/** Rough completeness score used for the animated progress ring. */
export function completeness(v: EditableProfile) {
  const checks = [
    v.full_name,
    v.display_name,
    v.pronouns,
    v.phone,
    v.section,
    v.bio,
    v.avatar_url,
    v.github_url || v.linkedin_url || v.website_url,
  ];
  const done = checks.filter((x) => String(x ?? "").trim().length > 0).length;
  return Math.round((done / checks.length) * 100);
}

export function normaliseLink(value: string) {
  const v = value.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}
