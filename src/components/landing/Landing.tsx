import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  CalendarRange,
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
  { n: "01", t: "Create your account", d: "Sign in with Google or your email." },
  { n: "02", t: "Request your batch", d: "Pick your batch and send an access request." },
  { n: "03", t: "Get approved", d: "A moderator approves you and the full board unlocks." },
];

export function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-ground font-body text-ink">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="aurora-a absolute -left-24 -top-28 h-[340px] w-[420px] rounded-full bg-cyan/20 blur-[120px]" />
        <div className="aurora-c absolute right-[-80px] top-[240px] h-[320px] w-[420px] rounded-full bg-violet/20 blur-[130px]" />
        <div className="aurora-b absolute bottom-[-140px] left-[30%] h-[380px] w-[480px] rounded-full bg-magenta/15 blur-[140px]" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-[1180px] items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface2 font-display text-xs font-semibold text-cyan ring-1 ring-border">
            TM
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-display text-sm font-semibold tracking-tight sm:text-base">
              TAPMI Manipal
            </span>
            <span className="block truncate font-mono text-[10px] text-dim">Student portal</span>
          </span>
        </Link>
        <Link
          to="/auth"
          className="shrink-0 rounded-xl bg-cyan px-4 py-2 text-sm font-semibold text-ground ring-1 ring-cyan"
        >
          Sign in
        </Link>
      </header>

      <main className="relative z-10 mx-auto max-w-[1180px] px-5 pb-24 sm:px-8">
        <section className="pt-10 sm:pt-20">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease }}
            className="font-mono text-[11px] uppercase tracking-[0.22em] text-dim"
          >
            TAPMI Manipal · IPM
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05, ease }}
            className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl"
          >
            Every deadline, class and attendance mark in one place.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12, ease }}
            className="mt-5 max-w-xl text-base leading-relaxed text-dim sm:text-lg"
          >
            A private board for your batch — quizzes, submissions, the live timetable and your
            attendance percentage, kept accurate by your class reps.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.18, ease }}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Link
              to="/auth"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-cyan px-5 py-3 text-sm font-semibold text-ground shadow-[0_0_32px_-8px_var(--cyan)] ring-1 ring-cyan"
            >
              Sign in to your batch
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <span className="inline-flex items-center gap-2 rounded-xl px-1 font-mono text-[11px] text-faint">
              <Lock className="size-3.5" /> Batch data is visible only after moderator approval
            </span>
          </motion.div>
        </section>

        <section className="mt-16 grid gap-4 sm:mt-24 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.25), ease }}
              whileHover={{ y: -4 }}
              className="rounded-2xl bg-surface/60 p-5 ring-1 ring-border backdrop-blur-sm transition-colors hover:ring-cyan/35"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-surface2 ring-1 ring-border">
                <f.icon className="size-4 text-cyan" />
              </span>
              <h2 className="mt-4 font-display text-base font-semibold tracking-tight">{f.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-dim">{f.body}</p>
            </motion.div>
          ))}
        </section>

        <section className="mt-16 sm:mt-24">
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
                className="rounded-2xl bg-surface2/40 p-5 ring-1 ring-border"
              >
                <p className="font-mono text-[11px] tracking-[0.2em] text-cyan">{s.n}</p>
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
          className="mt-16 rounded-3xl bg-surface/70 px-6 py-12 text-center ring-1 ring-border sm:mt-24 sm:px-12"
        >
          <h2 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Stop hunting through group chats for due dates.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-dim sm:text-base">
            Sign in, join your batch, and everything your class shares lands on one board.
          </p>
          <Link
            to="/auth"
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-cyan px-5 py-3 text-sm font-semibold text-ground ring-1 ring-cyan"
          >
            Get started <ArrowRight className="size-4" />
          </Link>
        </motion.section>
      </main>

      <footer className="relative z-10 border-t border-border px-5 py-8 text-center font-mono text-[11px] text-faint sm:px-8">
        TAPMI Manipal student portal · built by students, for students
      </footer>
    </div>
  );
}
