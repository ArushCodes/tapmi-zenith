import {
  eventMeta,
  formatDeadlineWhen,
  phaseOf,
  timeLeft,
  typeLabel,
  urgencyOf,
  type Deadline,
} from "@/lib/deadlines";


const accent: Record<string, string> = {
  past: "bg-faint",
  critical: "bg-rose blink",
  soon: "bg-amber",
  later: "bg-cyan/60",
};

const countdownColor: Record<string, string> = {
  past: "text-faint",
  critical: "text-rose blink",
  soon: "text-amber",
  later: "text-cyan",
};

const hoverRing: Record<string, string> = {
  past: "hover:ring-border",
  critical: "hover:ring-rose/40",
  soon: "hover:ring-amber/40",
  later: "hover:ring-cyan/40",
};

type Props = {
  deadline: Deadline;
  now: number;
  canManage: boolean;
  onEdit: (d: Deadline) => void;
  onDelete: (d: Deadline) => void;
  onOpen?: (d: Deadline) => void;
};

export function DeadlineRow({ deadline, now, canManage, onEdit, onDelete, onOpen }: Props) {
  const phase = phaseOf(deadline, now);
  const u = phase === "completed" ? "past" : urgencyOf(deadline.due_at, now);
  const meta = eventMeta(deadline.type);


  return (
    <div
      className={`group relative grid grid-cols-[1fr_auto] items-center gap-4 rounded-xl bg-surface px-4 py-3.5 ring-1 ring-border transition-transform duration-200 hover:-translate-y-0.5 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] ${hoverRing[u]}`}
    >
      <span className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full ${accent[u]}`} />
      <button
        type="button"
        onClick={() => onOpen?.(deadline)}
        className="min-w-0 pl-2 text-left"
      >
        <p className="truncate font-display text-[15px] font-semibold tracking-tight">
          {deadline.subject} — {deadline.title}
        </p>
        <p className="truncate font-mono text-[11px] text-dim">
          {[formatDeadlineWhen(deadline), deadline.location].filter(Boolean).join(" · ")}
        </p>

      </button>

      <span className={`hidden rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wide sm:block ${meta.chip}`}>
        {typeLabel(deadline.type)}
      </span>

      <span
        className={
          deadline.work_mode === "group"
            ? "hidden rounded-md bg-violet/10 px-2 py-1 font-mono text-[10px] text-violet ring-1 ring-violet/25 sm:block"
            : "hidden rounded-md bg-surface2 px-2 py-1 font-mono text-[10px] text-dim ring-1 ring-border sm:block"
        }
      >
        {deadline.work_mode === "group"
          ? `Group${deadline.group_size ? ` · ${deadline.group_size}` : ""}`
          : "Individual"}
      </span>

      <div className="flex items-center gap-3 justify-self-end">
        <p className={`font-mono text-sm font-semibold ${countdownColor[u]}`}>
          {timeLeft(deadline.due_at, now)}
        </p>
        <div className="hidden items-center gap-1 sm:flex">
          {deadline.submission_link && (
            <a
              href={deadline.submission_link}
              target="_blank"
              rel="noreferrer"
              className="rounded-md px-2 py-1 font-mono text-[11px] text-dim ring-1 ring-border transition-colors hover:text-cyan hover:ring-cyan/40"
            >
              Open
            </a>
          )}
          {canManage && (
            <>
              <button
                onClick={() => onEdit(deadline)}
                className="rounded-md px-2 py-1 font-mono text-[11px] text-dim ring-1 ring-border transition-colors hover:text-amber"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(deadline)}
                className="rounded-md px-2 py-1 font-mono text-[11px] text-dim ring-1 ring-border transition-colors hover:text-rose"
              >
                Del
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
