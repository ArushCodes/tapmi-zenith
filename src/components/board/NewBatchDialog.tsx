import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Plus, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createBatch, hierarchyQuery } from "@/lib/hierarchy";
import { useBatch } from "@/hooks/use-batch";

const NEW = "__new__";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="font-mono text-[10px] uppercase tracking-wide text-dim">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg bg-surface2 px-3 py-2 text-sm outline-none ring-1 ring-border transition focus:ring-cyan/50";

export function NewBatchDialog({ onClose }: { onClose: () => void }) {
  const { setBatchId } = useBatch();
  const queryClient = useQueryClient();
  const { data } = useQuery(hierarchyQuery);

  const institutions = data?.institutions ?? [];
  const [instId, setInstId] = useState<string>("");
  const [instName, setInstName] = useState("");
  const [schoolId, setSchoolId] = useState<string>("");
  const [schoolName, setSchoolName] = useState("");
  const [progId, setProgId] = useState<string>("");
  const [progName, setProgName] = useState("");
  const [name, setName] = useState("");
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");

  const schools = useMemo(
    () => (data?.schools ?? []).filter((s) => s.institution_id === instId),
    [data, instId],
  );
  const programmes = useMemo(
    () => (data?.programmes ?? []).filter((p) => p.school_id === schoolId),
    [data, schoolId],
  );

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Give the batch a name");
      const institution =
        instId && instId !== NEW ? { id: instId } : { name: instName.trim() };
      const school = schoolId && schoolId !== NEW ? { id: schoolId } : { name: schoolName.trim() };
      const programme = progId && progId !== NEW ? { id: progId } : { name: progName.trim() };
      if (!("id" in institution) && !institution.name) throw new Error("Institution required");
      if (!("id" in school) && !school.name) throw new Error("School required");
      if (!("id" in programme) && !programme.name) throw new Error("Programme required");
      return createBatch({
        institution,
        school,
        programme,
        name: name.trim(),
        startYear: startYear ? Number(startYear) : null,
        endYear: endYear ? Number(endYear) : null,
      });
    },
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ["batch-tree"] });
      await queryClient.invalidateQueries({ queryKey: ["hierarchy"] });
      await queryClient.invalidateQueries({ queryKey: ["my-memberships"] });
      setBatchId(id);
      toast.success("Batch created — you're its admin");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 24, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 24, opacity: 0, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          onClick={(e) => e.stopPropagation()}
          className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-surface p-5 ring-1 ring-border sm:rounded-2xl"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold">New batch</h2>
              <p className="font-mono text-[11px] text-dim">
                Institution → School → Programme → Batch
              </p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-dim hover:bg-surface2">
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-3">
            <Field label="Institution">
              <select
                className={inputCls}
                value={instId}
                onChange={(e) => {
                  setInstId(e.target.value);
                  setSchoolId("");
                  setProgId("");
                }}
              >
                <option value="">Select…</option>
                {institutions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
                <option value={NEW}>+ New institution</option>
              </select>
            </Field>
            {instId === NEW && (
              <input
                className={inputCls}
                placeholder="Institution name"
                value={instName}
                onChange={(e) => setInstName(e.target.value)}
              />
            )}

            <Field label="School / College">
              <select
                className={inputCls}
                value={schoolId}
                onChange={(e) => {
                  setSchoolId(e.target.value);
                  setProgId("");
                }}
                disabled={!instId}
              >
                <option value="">Select…</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                <option value={NEW}>+ New school</option>
              </select>
            </Field>
            {schoolId === NEW && (
              <input
                className={inputCls}
                placeholder="School name (e.g. TAPMI)"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
              />
            )}

            <Field label="Programme">
              <select
                className={inputCls}
                value={progId}
                onChange={(e) => setProgId(e.target.value)}
                disabled={!schoolId}
              >
                <option value="">Select…</option>
                {programmes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                <option value={NEW}>+ New programme</option>
              </select>
            </Field>
            {progId === NEW && (
              <input
                className={inputCls}
                placeholder="Programme name (e.g. IPM)"
                value={progName}
                onChange={(e) => setProgName(e.target.value)}
              />
            )}

            <Field label="Batch name">
              <input
                className={inputCls}
                placeholder="IPM-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Start year">
                <input
                  className={inputCls}
                  inputMode="numeric"
                  placeholder="2025"
                  value={startYear}
                  onChange={(e) => setStartYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                />
              </Field>
              <Field label="End year">
                <input
                  className={inputCls}
                  inputMode="numeric"
                  placeholder="2030"
                  value={endYear}
                  onChange={(e) => setEndYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                />
              </Field>
            </div>
          </div>

          <button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan/15 px-4 py-2.5 font-mono text-[11px] uppercase tracking-wide text-cyan ring-1 ring-cyan/30 transition hover:bg-cyan/25 disabled:opacity-60"
          >
            {create.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            Create batch
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
