import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  CalendarRange,
  Check,
  ListFilter,
  Lock,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

const features = [
  {
    icon: ListFilter,
    title: "Deadline feed",
    body: "Quizzes, assignments, presentations and exams sorted by time left, with urgency colours.",
  },
  {
    icon: CalendarRange,
    title: "Interactive calendar",
    body: "Month, week and agenda views with colour-coded event types and quick .ics export.",
  },
  {
    icon: CalendarClock,
    title: "Live timetable",
    body: "Classes sync straight from your batch feed — rooms, faculty and section, always current.",
  },
  {
    icon: UserCheck,
    title: "Attendance tracker",
    body: "Mark yourself present or absent, watch your percentage, and keep an absentee workbook.",
  },
  {
    icon: ShieldCheck,
    title: "Moderator controls",
    body: "Class reps approve deadlines, manage members and keep the board honest.",
  },
  {
    icon: Lock,
    title: "Batch-private",
    body: "Every timetable, deadline and attendance row is locked to your approved batch.",
  },
];

const steps = [
  { n: "01", t: "Create your account", d: "Sign in with Google or your learner email." },
  { n: "02", t: "Join your batch", d: "Pick your batch — your board is scoped to it." },
  { n: "03", t: "Stay ahead", d: "Deadlines, timetable and attendance in one place." },
];

/** MAHE constituent institutions the portal can be rolled out to. */
const colleges = [
  { name: "TAPMI", city: "Manipal", note: "T. A. Pai Management Institute", live: true },
  { name: "MIT", city: "Manipal", note: "Manipal Institute of Technology" },
  { name: "KMC", city: "Manipal", note: "Kasturba Medical College" },
  { name: "KMC", city: "Mangalore", note: "Kasturba Medical College" },
  { name: "MCODS", city: "Manipal", note: "Manipal College of Dental Sciences" },
  { name: "MCHP", city: "Manipal", note: "Manipal College of Health Professions" },
  { name: "MSAP", city: "Manipal", note: "School of Architecture & Planning" },
  { name: "MCOPS", city: "Manipal", note: "Manipal College of Pharmaceutical Sciences" },
  { name: "MIC", city: "Manipal", note: "Manipal Institute of Communication" },
  { name: "MAHE", city: "Bengaluru", note: "MAHE Bengaluru campus" },
  { name: "MAHE", city: "Jamshedpur", note: "MAHE Jamshedpur campus" },
  { name: "MAHE", city: "Dubai", note: "MAHE Dubai campus" },
];

const preview = [
  { t: "Sociology Quiz 2", w: "Tomorrow · 09:30", tone: "text-evt-quiz" },
  { t: "Economics Assignment", w: "Fri · 23:59", tone: "text-evt-assign" },
  { t: "Statistics Midterm", w: "Mon · 14:00", tone: "text-evt-exam" },
];

export function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-ground font-body text-ink">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -left-32 -top-40 h-[460px] w-[600px] rounded-full bg-cyan/12 blur-[140px]" />
        <div className="absolute right-[-120px] top-[220px] h-[420px] w-[520px] rounded-full bg-amber/12 blur-[150px]" />
      </div>

      <header className="sticky top-0 z-20 border-b border-border bg-ground/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-3 px-5 sm:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan font-display text-[15px] font-semibold text-white shadow-[0_6px_18px_-8px_var(--cyan)]">
              Z
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-display text-[15px] font-semibold tracking-tight sm:text-base">
                Zenith
              </span>
              <span className="block truncate font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                TAPMI Manipal · MAHE
              </span>
            </span>
          </Link>
          <Link
            to="/auth"
            className="shrink-0 rounded-xl bg-cyan px-4 py-2 text-[13px] font-semibold text-white shadow-[0_6px_20px_-10px_var(--cyan)]"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1180px] px-5 pb-24 sm:px-8">
        {/* Split hero */}
        <section className="grid items-center gap-12 pt-14 sm:pt-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease }}
              className="inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan"
            >
              Built for TAPMI Manipal
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05, ease }}
              className="mt-5 font-display text-4xl font-semibold leading-[1.04] tracking-tight text-balance sm:text-6xl"
            >
              Every deadline, class and attendance mark at its{" "}
              <span className="text-cyan">zenith</span>.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12, ease }}
              className="mt-5 max-w-xl text-base leading-relaxed text-dim sm:text-lg"
            >
              Zenith is the private board for your batch — quizzes, submissions, the live timetable
              and your attendance percentage, kept accurate by your class reps.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.18, ease }}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <Link
                to="/auth"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-cyan px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-12px_var(--cyan)]"
              >
                Sign in to your batch
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <span className="inline-flex items-center gap-2 rounded-xl px-1 font-mono text-[11px] text-faint">
                <Lock className="size-3.5" /> Batch data is visible only to approved members
              </span>
            </motion.div>
          </div>

          {/* Product preview card */}
          <motion.div
            initial={{ opacity: 0, y: 24, rotate: -1 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.6, delay: 0.12, ease }}
            className="rounded-3xl border border-border bg-surface p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.35)]"
          >
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                This week
              </p>
              <span className="rounded-full bg-cyan/12 px-2 py-1 font-mono text-[10px] text-cyan">
                IPM · Batch board
              </span>
            </div>
            <div className="mt-4 flex flex-col gap-2.5">
              {preview.map((p, i) => (
                <motion.div
                  key={p.t}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.25 + i * 0.08, ease }}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-ground px-4 py-3"
                >
                  <span className={`text-lg leading-none ${p.tone}`}>•</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[13px] font-semibold">
                      {p.t}
                    </span>
                    <span className="block font-mono text-[10px] text-faint">{p.w}</span>
                  </span>
                </motion.div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface2 px-4 py-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
                Attendance
              </span>
              <span className="font-display text-lg font-semibold text-evt-present">92%</span>
            </div>
          </motion.div>
        </section>

        <section className="mt-20 grid gap-4 sm:mt-28 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.25), ease }}
              whileHover={{ y: -4 }}
              className="rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-cyan/40"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-cyan/10">
                <f.icon className="size-4 text-cyan" />
              </span>
              <h2 className="mt-4 font-display text-base font-semibold tracking-tight">{f.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-dim">{f.body}</p>
            </motion.div>
          ))}
        </section>

        <section className="mt-20 sm:mt-28">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Built for every MAHE campus
          </h2>
          <p className="mt-2 max-w-xl text-sm text-dim sm:text-base">
            Starting with TAPMI Manipal — any constituent institution under Manipal Academy of
            Higher Education can be added, batch by batch.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {colleges.map((c, i) => (
              <motion.div
                key={`${c.name}-${c.city}`}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.3), ease }}
                whileHover={{ y: -3 }}
                className={`flex items-center gap-3 rounded-2xl border p-4 transition-colors ${
                  c.live
                    ? "border-cyan/40 bg-cyan/8"
                    : "border-border bg-surface hover:border-cyan/30"
                }`}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface2 font-display text-[11px] font-semibold text-cyan">
                  {c.name.slice(0, 4)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-display text-sm font-semibold tracking-tight">
                    {c.name} {c.city}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-dim">{c.note}</span>
                </span>
                <span
                  className={`ml-auto shrink-0 rounded-md px-2 py-1 font-mono text-[9px] uppercase tracking-wide ${
                    c.live ? "bg-cyan text-white" : "border border-border text-faint"
                  }`}
                >
                  {c.live ? "Live" : "Soon"}
                </span>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mt-20 sm:mt-28">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Getting in takes a minute
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: i * 0.07, ease }}
                className="rounded-2xl border border-border bg-surface p-5"
              >
                <p className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-cyan">
                  <Check className="size-3.5" /> {s.n}
                </p>
                <p className="mt-3 font-display text-base font-semibold tracking-tight">{s.t}</p>
                <p className="mt-1.5 text-sm text-dim">{s.d}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease }}
          className="mt-20 rounded-3xl border border-border bg-surface px-6 py-12 text-center sm:mt-28 sm:px-12"
        >
          <h2 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Stop hunting through group chats for due dates.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-dim sm:text-base">
            Sign in, join your batch, and everything your class shares lands on one board.
          </p>
          <Link
            to="/auth"
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-cyan px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-12px_var(--cyan)]"
          >
            Get started <ArrowRight className="size-4" />
          </Link>
        </motion.section>
      </main>

      <footer className="relative z-10 border-t border-border px-5 py-8 text-center font-mono text-[11px] text-faint sm:px-8">
        Zenith · TAPMI Manipal · built by students, for students
      </footer>
    </div>
  );
}
