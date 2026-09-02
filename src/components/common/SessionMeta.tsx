import { motion } from "framer-motion";
import type { ClassSession } from "@/lib/types";
import { sessionLabel, sessionNumberOf } from "@/lib/courses";

type Chip = { key: string; text: string; mono?: boolean; accent?: boolean };

/** Builds the chip list shown under a class: session no, code, full name, faculty, room. */
export function sessionMetaChips(s: ClassSession, opts?: { withFullName?: boolean }): Chip[] {
  if (s.is_holiday) return [{ key: "holiday", text: "No classes scheduled" }];
  const chips: Chip[] = [];
  const n = sessionNumberOf(s);
  if (n) chips.push({ key: "sn", text: `S${n}`, mono: true, accent: true });
  if (s.course_code) chips.push({ key: "code", text: s.course_code, mono: true, accent: true });
  const full = s.course_name?.trim();
  const short = sessionLabel(s);
  if ((opts?.withFullName ?? true) && full && full.toLowerCase() !== short.toLowerCase()) {
    chips.push({ key: "name", text: full });
  }
  if (s.faculty_name) chips.push({ key: "fac", text: s.faculty_name });
  if (s.section) chips.push({ key: "sec", text: `Sec ${s.section}` });
  if (s.classroom) chips.push({ key: "room", text: s.classroom, mono: true });
  return chips;
}

/**
 * Compact, animated metadata strip rendered under every class label so each
 * batch shows session number, course code, faculty and room consistently.
 */
export function SessionMeta({
  session,
  className = "",
  withFullName = true,
  max,
}: {
  session: ClassSession;
  className?: string;
  withFullName?: boolean;
  max?: number;
}) {
  const all = sessionMetaChips(session, { withFullName });
  const chips = max ? all.slice(0, max) : all;
  if (!chips.length) return null;
  return (
    <span className={`mt-1 flex flex-wrap items-center gap-1 ${className}`}>
      {chips.map((c, i) => (
        <motion.span
          key={c.key}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.02 * i, duration: 0.18 }}
          className={`max-w-full truncate rounded px-1.5 py-0.5 text-[10px] leading-4 ${
            c.mono ? "font-mono" : ""
          } ${
            c.accent
              ? "bg-accent/10 text-accent"
              : "bg-surface-2/70 text-dim"
          }`}
        >
          {c.text}
        </motion.span>
      ))}
    </span>
  );
}
