import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { db as supabase } from "@/lib/backend";
import { DAY_COLORS, type DayMark } from "@/lib/day-marks";

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

type Props = {
  /** YYYY-MM-DD of the day being styled, or null when closed. */
  day: string | null;
  batchId: string | null;
  mark: DayMark | null;
  onClose: () => void;
};

/** Moderator editor that colours and labels a day for the whole batch. */
export function DayMarkDialog({ day, batchId, mark, onClose }: Props) {
  const queryClient = useQueryClient();
  const [color, setColor] = useState(DAY_COLORS[0]!.value);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [isOff, setIsOff] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!day) return;
    setColor(mark?.color ?? DAY_COLORS[0]!.value);
    setLabel(mark?.label ?? "");
    setNote(mark?.note ?? "");
    setIsOff(mark?.is_off ?? false);
  }, [day, mark]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["day-marks"] });

  async function save() {
    if (!day || !batchId) return;
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("batch_day_marks").upsert(
      {
        batch_id: batchId,
        day,
        color,
        label: label.trim() || null,
        note: note.trim() || null,
        is_off: isOff,
        created_by: auth.user?.id ?? null,
      },
      { onConflict: "batch_id,day" },
    );
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Day updated for the batch");
    refresh();
    onClose();
  }

  async function clear() {
    if (!mark) {
      onClose();
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("batch_day_marks").delete().eq("id", mark.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Day styling removed");
    refresh();
    onClose();
  }

  return (
    <AnimatePresence>
      {day && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ground/70 backdrop-blur-sm"
          />
          <motion.div
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-label="Style this day"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-5 ring-1 ring-border"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
                  Day settings · whole batch
                </p>
                <h2 className="mt-1 font-display text-lg font-semibold tracking-tight">
                  {dayFmt.format(new Date(`${day}T12:00:00`))}
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-md p-1.5 text-dim ring-1 ring-border hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <div>
                <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                  Colour
                </span>
                <div className="flex flex-wrap gap-2">
                  {DAY_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      aria-label={c.label}
                      aria-pressed={color === c.value}
                      onClick={() => setColor(c.value)}
                      style={{ backgroundColor: c.value }}
                      className={`size-7 rounded-full transition-transform ${
                        color === c.value ? "scale-110 ring-2 ring-ink" : "opacity-70"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                  Label
                </span>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Mid-term week"
                  className="w-full rounded-lg bg-surface2 px-3 py-2 text-sm ring-1 ring-border outline-none focus:ring-cyan/40"
                />
              </label>

              <label className="block">
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                  Note
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Optional detail everyone in the batch will see"
                  className="w-full rounded-lg bg-surface2 px-3 py-2 text-sm ring-1 ring-border outline-none focus:ring-cyan/40"
                />
              </label>

              <label className="flex items-center gap-2 font-mono text-[11px] text-dim">
                <input
                  type="checkbox"
                  checked={isOff}
                  onChange={(e) => setIsOff(e.target.checked)}
                  className="accent-cyan"
                />
                Treat as a day off / no classes
              </label>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                onClick={clear}
                disabled={busy || !mark}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-mono text-[11px] text-rose ring-1 ring-rose/30 transition-colors hover:bg-rose/10 disabled:opacity-40"
              >
                <Trash2 className="size-3.5" /> Clear
              </button>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="rounded-lg px-3 py-2 font-mono text-[11px] text-dim ring-1 ring-border hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={busy}
                  className="rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-ground disabled:opacity-60"
                >
                  Save
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
