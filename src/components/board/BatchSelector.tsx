import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, GraduationCap, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useBatch } from "@/hooks/use-batch";
import { NewBatchDialog } from "@/components/board/NewBatchDialog";

export function BatchSelector() {
  const { isAdmin } = useAuth();
  const { batches, batch, batchId, setBatchId } = useBatch();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex max-w-[62vw] items-center gap-2 rounded-lg bg-surface2 px-3 py-2 text-left ring-1 ring-border transition-colors hover:ring-cyan/40 sm:max-w-none"
        >
          <GraduationCap className="size-4 shrink-0 text-cyan" />
          <span className="min-w-0">
            <span className="block truncate font-display text-sm font-semibold leading-tight">
              {batch?.name ?? "Select batch"}
            </span>
            <span className="block truncate font-mono text-[10px] text-dim">
              {batch?.path ?? "MAHE"}
            </span>
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-dim" />
        </button>

        <AnimatePresence>
          {open && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="absolute left-0 z-40 mt-2 max-h-80 w-[min(18rem,80vw)] overflow-auto rounded-xl bg-surface p-1.5 shadow-2xl shadow-black/50 ring-1 ring-border"
              >
                {batches.length === 0 && (
                  <p className="px-3 py-4 text-center font-mono text-[11px] text-faint">
                    No batches yet.
                  </p>
                )}
                {batches.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setBatchId(b.id);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{b.name}</span>
                      <span className="block truncate font-mono text-[10px] text-dim">
                        {b.path} · {b.programme_name}
                      </span>
                    </span>
                    {b.id === batchId && <Check className="size-3.5 shrink-0 text-cyan" />}
                  </button>
                ))}
                {isAdmin && (
                  <button
                    onClick={() => {
                      setOpen(false);
                      setCreating(true);
                    }}
                    className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-border px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wide text-cyan transition-colors hover:bg-surface2"
                  >
                    <Plus className="size-3.5" /> New batch
                  </button>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {creating && <NewBatchDialog onClose={() => setCreating(false)} />}
    </div>
  );

}
