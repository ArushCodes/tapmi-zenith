import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CalendarPlus, Megaphone, UserPlus } from "lucide-react";
import { useBatch } from "@/hooks/use-batch";
import { batchMembersQuery } from "@/lib/batches";
import { announcementsQuery } from "@/lib/announcements";
import { deadlinesQueryFor } from "@/lib/deadlines";

const when = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

type Item = {
  id: string;
  at: number;
  kind: "member" | "announcement" | "deadline";
  title: string;
  sub: string;
};

/** Batch notification stream: who joined, what got posted, what got scheduled. */
export function ActivityPanel({ compact = false }: { compact?: boolean }) {
  const { batchId, batch, isMember } = useBatch();
  const { data: members = [] } = useQuery(batchMembersQuery(batchId, isMember));
  const { data: announcements = [] } = useQuery(announcementsQuery(batchId));
  const { data: deadlines = [] } = useQuery(deadlinesQueryFor(batchId));

  const where = batch ? `${batch.programme_name} · ${batch.name}` : "this batch";

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];

    for (const m of members) {
      const who = m.profiles?.full_name ?? m.profiles?.email ?? "Someone";
      out.push({
        id: `m-${m.id}`,
        at: new Date(m.created_at).getTime(),
        kind: "member",
        title: `${who} joined ${where}`,
        sub: `${m.role === "student" ? "Student" : m.role === "mod" ? "Moderator" : "Admin"} · ${
          m.profiles?.email ?? "no email on file"
        }`,
      });
    }

    for (const a of announcements) {
      out.push({
        id: `a-${a.id}`,
        at: new Date(a.created_at).getTime(),
        kind: "announcement",
        title: a.title,
        sub: `Announcement posted to ${where}`,
      });
    }

    for (const d of deadlines) {
      out.push({
        id: `d-${d.id}`,
        at: new Date(d.created_at).getTime(),
        kind: "deadline",
        title: d.title,
        sub: `${d.type.replace(/_/g, " ")} added for ${d.subject}`,
      });
    }

    return out.sort((a, b) => b.at - a.at).slice(0, compact ? 5 : 50);
  }, [members, announcements, deadlines, where, compact]);

  if (!isMember) return null;

  return (
    <section className={compact ? "" : "mt-4"}>
      <div className="mb-3 flex items-center gap-2">
        <Bell className="size-3.5 text-cyan" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
          {compact ? "Latest activity" : "Notifications"}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {items.length === 0 ? (
            <p className="rounded-xl bg-surface px-3 py-6 text-center font-mono text-[11px] text-faint ring-1 ring-border">
              Nothing has happened here yet.
            </p>
          ) : (
            items.map((it, i) => (
              <motion.article
                key={it.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                whileHover={{ y: -2 }}
                className="flex items-start gap-3 rounded-xl bg-surface px-3 py-3 ring-1 ring-border"
              >
                <span className="mt-0.5 shrink-0 text-dim">
                  {it.kind === "member" ? (
                    <UserPlus className="size-4 text-evt-present" />
                  ) : it.kind === "announcement" ? (
                    <Megaphone className="size-4 text-amber" />
                  ) : (
                    <CalendarPlus className="size-4 text-violet" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[13px] font-semibold">
                    {it.title}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-dim">{it.sub}</span>
                </span>
                <span className="shrink-0 font-mono text-[10px] text-faint">
                  {when.format(new Date(it.at))}
                </span>
              </motion.article>
            ))
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
