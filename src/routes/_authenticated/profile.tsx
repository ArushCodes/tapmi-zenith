import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  AtSign,
  BadgeCheck,
  Bell,
  Check,
  Github,
  Globe,
  Hash,
  IdCard,
  Linkedin,
  Loader2,
  Lock,
  Phone,
  RotateCcw,
  Sparkles,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useBatch } from "@/hooks/use-batch";
import { BoardHeader } from "@/components/board/BoardHeader";
import {
  TIMEZONES,
  completeness,
  initialsOf,
  normaliseLink,
  profileQuery,
  toEditable,
  type EditableProfile,
} from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — MAHE Student Portal" },
      {
        name: "description",
        content:
          "Edit your MAHE portal profile: display name, pronouns, section, contact links and deadline reminder preferences.",
      },
      { property: "og:title", content: "Your profile — MAHE Student Portal" },
      {
        property: "og:description",
        content: "Personalise your MAHE portal account and reminder preferences.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage;
});

type SectionKey = "identity" | "links" | "prefs" | "locked";

const SECTIONS: { key: SectionKey; label: string; icon: React.ReactNode }[] = [
  { key: "identity", label: "Identity", icon: <UserRound className="size-3.5" /> },
  { key: "links", label: "Links", icon: <Globe className="size-3.5" /> },
  { key: "prefs", label: "Preferences", icon: <Bell className="size-3.5" /> },
  { key: "locked", label: "Permanent", icon: <Lock className="size-3.5" /> },
];

const spring = { type: "spring" as const, stiffness: 420, damping: 34 };

function Field({
  label,
  hint,
  icon,
  children,
}: {
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.label
      layout
      className="group flex flex-col gap-2"
      whileHover={{ y: -2 }}
      transition={spring}
    >
      <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-faint transition-colors group-focus-within:text-cyan">
        {icon}
        {label}
      </span>
      {children}
      {hint && <span className="font-mono text-[10px] text-faint">{hint}</span>}
    </motion.label>
  );
}

const inputClass =
  "w-full rounded-xl bg-surface2/60 px-4 py-3 text-sm text-ink ring-1 ring-border outline-none transition-all duration-200 placeholder:text-faint hover:ring-cyan/25 focus:bg-surface2 focus:ring-2 focus:ring-cyan/50";

function ProfilePage() {
  const { user, roles, isModerator } = useAuth();
  const { batch, membership } = useBatch();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery(profileQuery(user?.id));

  const [section, setSection] = useState<SectionKey>("identity");
  const [form, setForm] = useState<EditableProfile>(() => toEditable(null));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (profile && !hydrated) {
      setForm(toEditable(profile));
      setHydrated(true);
    }
  }, [profile, hydrated]);

  const baseline = useMemo(() => toEditable(profile), [profile]);
  const dirty = useMemo(
    () => JSON.stringify(baseline) !== JSON.stringify(form),
    [baseline, form],
  );
  const pct = completeness(form);

  function set<K extends keyof EditableProfile>(key: K, value: EditableProfile[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not signed in");
      const payload = {
        ...form,
        full_name: form.full_name.trim() || null,
        display_name: form.display_name.trim() || null,
        pronouns: form.pronouns.trim() || null,
        phone: form.phone.trim() || null,
        section: form.section.trim() || null,
        bio: form.bio.trim() || null,
        avatar_url: form.avatar_url.trim() ? normaliseLink(form.avatar_url) : null,
        github_url: form.github_url.trim() ? normaliseLink(form.github_url) : null,
        linkedin_url: form.linkedin_url.trim() ? normaliseLink(form.linkedin_url) : null,
        website_url: form.website_url.trim() ? normaliseLink(form.website_url) : null,
      };
      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      setHydrated(false);
      toast.success("Profile saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const name = form.display_name || form.full_name || user?.email || "Student";
  const joined = profile?.created_at ? new Date(profile.created_at) : null;

  const locked: { label: string; value: string; icon: React.ReactNode }[] = [
    { label: "Email", value: profile?.email ?? user?.email ?? "—", icon: <AtSign className="size-3.5" /> },
    {
      label: "Registration no.",
      value: profile?.registration_no ?? "Not assigned yet",
      icon: <IdCard className="size-3.5" />,
    },
    {
      label: "Account role",
      value: roles.length ? roles.join(" · ") : "student",
      icon: <BadgeCheck className="size-3.5" />,
    },
    {
      label: "Batch",
      value: batch ? `${batch.name}${membership?.status ? ` · ${membership.status}` : ""}` : "—",
      icon: <Hash className="size-3.5" />,
    },
    {
      label: "Joined",
      value: joined
        ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(joined)
        : "—",
      icon: <Sparkles className="size-3.5" />,
    },
    { label: "User ID", value: user?.id?.slice(0, 8) + "…" || "—", icon: <Lock className="size-3.5" /> },
  ];

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-ground font-body text-ink">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="aurora-a absolute -left-24 -top-32 h-[420px] w-[560px] rounded-full bg-cyan/15 blur-[140px]" />
        <div className="aurora-c absolute -right-20 top-[260px] h-[380px] w-[520px] rounded-full bg-violet/15 blur-[150px]" />
      </div>

      <BoardHeader />

      <main className="relative z-10 mx-auto max-w-[1080px] px-6 pb-32 pt-4 sm:px-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-dim transition-colors hover:text-cyan"
          >
            <ArrowLeft className="size-3.5" /> Back to board
          </Link>
        </motion.div>

        {/* Hero */}
        <motion.section
          layout
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.05 }}
          className="mt-6 overflow-hidden rounded-3xl bg-surface/70 p-8 ring-1 ring-border backdrop-blur-xl sm:p-10"
        >
          <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center">
            <motion.div
              whileHover={{ scale: 1.04, rotate: -1.5 }}
              transition={spring}
              className="relative grid size-24 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan/30 via-violet/25 to-magenta/25 ring-1 ring-border"
            >
              {form.avatar_url ? (
                <img
                  src={form.avatar_url}
                  alt={`${name} avatar`}
                  loading="lazy"
                  className="size-full rounded-2xl object-cover"
                  onError={(e) => ((e.currentTarget.style.display = "none"))}
                />
              ) : (
                <span className="font-display text-2xl font-semibold tracking-tight">
                  {initialsOf(name)}
                </span>
              )}
              <motion.span
                aria-hidden
                className="pointer-events-none absolute -inset-1 rounded-[1.35rem] ring-1 ring-cyan/30"
                animate={{ opacity: [0.25, 0.7, 0.25] }}
                transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>

            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-dim">
                {batch ? `${batch.path} · ${batch.name}` : "MAHE academic portal"}
              </p>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {name}
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-dim">
                {form.bio || "Add a short bio so your batchmates know who you are."}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {[form.pronouns, form.section && `Section ${form.section}`, isModerator && "Moderator"]
                  .filter(Boolean)
                  .map((chip) => (
                    <motion.span
                      key={String(chip)}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-full bg-surface2/70 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-dim ring-1 ring-border"
                    >
                      {chip}
                    </motion.span>
                  ))}
              </div>
            </div>

            {/* Completeness ring */}
            <div className="relative grid size-24 shrink-0 place-items-center">
              <svg viewBox="0 0 100 100" className="absolute size-24 -rotate-90">
                <circle cx="50" cy="50" r="42" className="fill-none stroke-border" strokeWidth="7" />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="fill-none stroke-cyan"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 42}
                  initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - pct / 100) }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                />
              </svg>
              <div className="text-center">
                <p className="font-display text-lg font-semibold">{pct}%</p>
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-faint">done</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Section switcher */}
        <div className="mt-8 flex flex-wrap gap-1.5 rounded-2xl bg-surface2/50 p-1.5 ring-1 ring-border">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`relative flex items-center gap-2 rounded-xl px-4 py-2.5 font-mono text-[11px] uppercase tracking-wide transition-colors ${
                section === s.key ? "text-ink" : "text-dim hover:text-ink"
              }`}
            >
              {section === s.key && (
                <motion.span
                  layoutId="profile-section-pill"
                  className="absolute inset-0 rounded-xl bg-surface ring-1 ring-cyan/30"
                  transition={spring}
                />
              )}
              <span className="relative flex items-center gap-2">
                {s.icon}
                {s.label}
              </span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface2/50" />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.section
              key={section}
              initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -14, filter: "blur(6px)" }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 rounded-3xl bg-surface/60 p-8 ring-1 ring-border backdrop-blur-xl sm:p-10"
            >
              {section === "identity" && (
                <div className="grid gap-7 sm:grid-cols-2">
                  <Field label="Full name" icon={<UserRound className="size-3" />}>
                    <input
                      className={inputClass}
                      value={form.full_name}
                      onChange={(e) => set("full_name", e.target.value)}
                      placeholder="Arush Vipul Gaur"
                    />
                  </Field>
                  <Field label="Display name" hint="Shown to your batch across the portal.">
                    <input
                      className={inputClass}
                      value={form.display_name}
                      onChange={(e) => set("display_name", e.target.value)}
                      placeholder="Arush"
                    />
                  </Field>
                  <Field label="Pronouns">
                    <input
                      className={inputClass}
                      value={form.pronouns}
                      onChange={(e) => set("pronouns", e.target.value)}
                      placeholder="he/him"
                    />
                  </Field>
                  <Field label="Phone" icon={<Phone className="size-3" />} hint="Visible to moderators only.">
                    <input
                      className={inputClass}
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder="+91 …"
                    />
                  </Field>
                  <Field label="Section">
                    <input
                      className={inputClass}
                      value={form.section}
                      onChange={(e) => set("section", e.target.value)}
                      placeholder="A"
                    />
                  </Field>
                  <Field label="Avatar image URL">
                    <input
                      className={inputClass}
                      value={form.avatar_url}
                      onChange={(e) => set("avatar_url", e.target.value)}
                      placeholder="https://…"
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Bio" hint={`${form.bio.length}/280 characters`}>
                      <textarea
                        rows={4}
                        maxLength={280}
                        className={`${inputClass} resize-none leading-relaxed`}
                        value={form.bio}
                        onChange={(e) => set("bio", e.target.value)}
                        placeholder="First-year IPM student. Runs on filter coffee and deadlines."
                      />
                    </Field>
                  </div>
                </div>
              )}

              {section === "links" && (
                <div className="grid gap-7 sm:grid-cols-2">
                  <Field label="GitHub" icon={<Github className="size-3" />}>
                    <input
                      className={inputClass}
                      value={form.github_url}
                      onChange={(e) => set("github_url", e.target.value)}
                      placeholder="github.com/username"
                    />
                  </Field>
                  <Field label="LinkedIn" icon={<Linkedin className="size-3" />}>
                    <input
                      className={inputClass}
                      value={form.linkedin_url}
                      onChange={(e) => set("linkedin_url", e.target.value)}
                      placeholder="linkedin.com/in/username"
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Website" icon={<Globe className="size-3" />}>
                      <input
                        className={inputClass}
                        value={form.website_url}
                        onChange={(e) => set("website_url", e.target.value)}
                        placeholder="yoursite.com"
                      />
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-3 sm:col-span-2">
                    {[
                      { url: form.github_url, label: "GitHub", icon: <Github className="size-3.5" /> },
                      { url: form.linkedin_url, label: "LinkedIn", icon: <Linkedin className="size-3.5" /> },
                      { url: form.website_url, label: "Website", icon: <Globe className="size-3.5" /> },
                    ]
                      .filter((l) => l.url.trim())
                      .map((l) => (
                        <motion.a
                          key={l.label}
                          layout
                          whileHover={{ y: -3, scale: 1.03 }}
                          transition={spring}
                          href={normaliseLink(l.url)}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="flex items-center gap-2 rounded-xl bg-surface2/70 px-4 py-2.5 font-mono text-[11px] text-dim ring-1 ring-border hover:text-cyan hover:ring-cyan/40"
                        >
                          {l.icon} {l.label}
                        </motion.a>
                      ))}
                  </div>
                </div>
              )}

              {section === "prefs" && (
                <div className="grid gap-8">
                  <motion.div
                    layout
                    whileHover={{ y: -2 }}
                    transition={spring}
                    className="flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-surface2/50 px-6 py-5 ring-1 ring-border"
                  >
                    <div className="space-y-1">
                      <p className="font-display text-sm font-semibold">Email reminders</p>
                      <p className="text-xs text-dim">
                        Get a nudge before quizzes, submissions and exams.
                      </p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={form.notify_email}
                      aria-label="Email reminders"
                      onClick={() => set("notify_email", !form.notify_email)}
                      className={`relative h-8 w-14 rounded-full ring-1 transition-colors ${
                        form.notify_email ? "bg-cyan/25 ring-cyan/50" : "bg-surface ring-border"
                      }`}
                    >
                      <motion.span
                        layout
                        transition={spring}
                        className={`absolute top-1 size-6 rounded-full ${
                          form.notify_email ? "left-7 bg-cyan" : "left-1 bg-faint"
                        }`}
                      />
                    </button>
                  </motion.div>

                  <Field
                    label="Reminder lead time"
                    hint={`Alert me ${form.reminder_hours} hour${form.reminder_hours === 1 ? "" : "s"} before a deadline.`}
                  >
                    <input
                      type="range"
                      min={1}
                      max={168}
                      step={1}
                      value={form.reminder_hours}
                      onChange={(e) => set("reminder_hours", Number(e.target.value))}
                      className="w-full accent-cyan"
                    />
                  </Field>

                  <Field label="Timezone">
                    <select
                      className={inputClass}
                      value={form.timezone}
                      onChange={(e) => set("timezone", e.target.value)}
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}

              {section === "locked" && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <p className="font-mono text-[11px] leading-relaxed text-faint sm:col-span-2">
                    These details are tied to your account and can only be changed by an
                    administrator.
                  </p>
                  {locked.map((item, i) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * i, ...spring }}
                      whileHover={{ y: -2 }}
                      className="flex items-center justify-between gap-4 rounded-2xl bg-surface2/40 px-5 py-4 ring-1 ring-border"
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                          {item.icon}
                          {item.label}
                        </p>
                        <p className="mt-1.5 truncate text-sm text-ink">{item.value}</p>
                      </div>
                      <Lock className="size-4 shrink-0 text-faint" />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.section>
          </AnimatePresence>
        )}
      </main>

      {/* Sticky save bar */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={spring}
            className="fixed inset-x-0 bottom-0 z-40 px-5 pb-6"
          >
            <div className="mx-auto flex max-w-[720px] flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface/90 px-6 py-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] ring-1 ring-cyan/25 backdrop-blur-xl">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
                Unsaved changes
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setForm(baseline)}
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 font-mono text-[11px] uppercase tracking-wide text-dim ring-1 ring-border transition-colors hover:text-ink"
                >
                  <RotateCcw className="size-3.5" /> Reset
                </button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  whileHover={{ y: -2 }}
                  transition={spring}
                  disabled={save.isPending}
                  onClick={() => save.mutate()}
                  className="flex items-center gap-2 rounded-xl bg-cyan px-5 py-2.5 text-sm font-semibold text-ground shadow-[0_0_30px_-8px_var(--cyan)] disabled:opacity-70"
                >
                  {save.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Save changes
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
