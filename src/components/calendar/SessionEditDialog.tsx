import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { db as supabase } from "@/lib/backend";
import type { ClassSession } from "@/lib/batches";

/** Local <input type="datetime-local"> value for an ISO timestamp. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Props = {
  session: ClassSession | null;
  onClose: () => void;
};

/** Moderator/admin editor for any calendar entry that comes from the
 *  timetable: classes, custom events, holidays and academic entries. */
export function SessionEditDialog({ session, onClose }: Props) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [faculty, setFaculty] = useState("");
  const [room, setRoom] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [holiday, setHoliday] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    setTitle(session.title);
    setFaculty(session.faculty_name ?? "");
    setRoom(session.classroom ?? "");
    setStart(toLocalInput(session.start_at));
    setEnd(toLocalInput(session.end_at));
    setHoliday(session.is_holiday);
  }, [session]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["class-sessions"] });

  async function save() {
    if (!session) return;
    setBusy(true);
    const { error } = await supabase
      .from("class_sessions")
      .update({
        title,
        faculty_name: faculty || null,
        classroom: room || null,
        start_at: new Date(start).toISOString(),
        end_at: new Date(end).toISOString(),
        is_holiday: holiday,
      })
      .eq("id", session.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Event updated");
    refresh();
    onClose();
  }

  async function remove() {
    if (!session) return;
    setBusy(true);
    const { error } = await supabase.from("class_sessions").delete().eq("id", session.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Event removed");
    refresh();
    onClose();
  }

  return (
    <AnimatePresence>
      {session && (
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
            aria-label="Edit calendar event"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-5 ring-1 ring-border"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
                  Edit calendar event
                </p>
                <h2 className="mt-1 font-display text-lg font-semibold tracking-tight">
                  {session.title}
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
              <Field label="Title">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg bg-surface2 px-3 py-2 text-sm ring-1 ring-border outline-none focus:ring-cyan/40"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Starts">
                  <input
                    type="datetime-local"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="w-full rounded-lg bg-surface2 px-3 py-2 text-sm ring-1 ring-border outline-none focus:ring-cyan/40"
                  />
                </Field>
                <Field label="Ends">
                  <input
                    type="datetime-local"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="w-full rounded-lg bg-surface2 px-3 py-2 text-sm ring-1 ring-border outline-none focus:ring-cyan/40"
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Faculty">
                  <input
                    value={faculty}
                    onChange={(e) => setFaculty(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-lg bg-surface2 px-3 py-2 text-sm ring-1 ring-border outline-none focus:ring-cyan/40"
                  />
                </Field>
                <Field label="Room">
                  <input
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-lg bg-surface2 px-3 py-2 text-sm ring-1 ring-border outline-none focus:ring-cyan/40"
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 font-mono text-[11px] text-dim">
                <input
                  type="checkbox"
                  checked={holiday}
                  onChange={(e) => setHoliday(e.target.checked)}
                  className="accent-cyan"
                />
                Mark as a holiday / non-teaching day
              </label>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                onClick={remove}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-mono text-[11px] text-rose ring-1 ring-rose/30 transition-colors hover:bg-rose/10 disabled:opacity-60"
              >
                <Trash2 className="size-3.5" /> Remove
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
        {label}
      </span>
      {children}
    </label>
  );
}
