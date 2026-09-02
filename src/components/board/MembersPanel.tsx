import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, ShieldPlus, ShieldMinus, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useBatch } from "@/hooks/use-batch";
import { batchMembersQuery, type Membership } from "@/lib/batches";

type Row = Membership & { profiles: { full_name: string | null; email: string | null } | null };

export function MembersPanel() {
  const { batchId, canManage } = useBatch();
  const queryClient = useQueryClient();
  const { data: members = [], isLoading } = useQuery(batchMembersQuery(batchId, canManage));

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Membership> }) => {
      const { error } = await supabase
        .from("batch_memberships")
        .update({ ...patch, decided_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batch-members", batchId] });
      toast.success("Membership updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("batch_memberships").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batch-members", batchId] });
      toast.success("Member removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { pending, approved, others } = useMemo(() => {
    const rows = members as Row[];
    return {
      pending: rows.filter((m) => m.status === "pending"),
      approved: rows.filter((m) => m.status === "approved"),
      others: rows.filter((m) => m.status === "rejected" || m.status === "removed"),
    };
  }, [members]);

  if (!canManage) return null;
  if (isLoading)
    return <p className="mt-6 text-center font-mono text-xs text-faint">Loading members…</p>;

  function Person({ m }: { m: Row }) {
    const name = m.profiles?.full_name ?? m.profiles?.email ?? "Unknown member";
    return (
      <motion.div
        layout
        className="flex flex-wrap items-center gap-3 rounded-xl bg-surface px-3 py-3 ring-1 ring-border"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-sm font-semibold">{name}</span>
          <span className="block truncate font-mono text-[11px] text-dim">
            {m.profiles?.email ?? "—"} · {m.role}
          </span>
        </span>

        {m.status === "pending" ? (
          <>
            <button
              onClick={() => update.mutate({ id: m.id, patch: { status: "approved" } })}
              className="flex items-center gap-1.5 rounded-lg bg-evt-present/15 px-2.5 py-1.5 font-mono text-[11px] text-evt-present ring-1 ring-evt-present/30"
            >
              <Check className="size-3.5" /> Approve
            </button>
            <button
              onClick={() => update.mutate({ id: m.id, patch: { status: "rejected" } })}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-rose ring-1 ring-border"
            >
              <X className="size-3.5" /> Reject
            </button>
          </>
        ) : (
          <>
            {m.role === "student" ? (
              <button
                onClick={() => update.mutate({ id: m.id, patch: { role: "mod" } })}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-cyan ring-1 ring-border"
              >
                <ShieldPlus className="size-3.5" /> Make moderator
              </button>
            ) : (
              <button
                onClick={() => update.mutate({ id: m.id, patch: { role: "student" } })}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-dim ring-1 ring-border"
              >
                <ShieldMinus className="size-3.5" /> Demote
              </button>
            )}
            {m.status !== "approved" && (
              <button
                onClick={() => update.mutate({ id: m.id, patch: { status: "approved" } })}
                className="rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-evt-present ring-1 ring-border"
              >
                Restore
              </button>
            )}
            <button
              onClick={() => remove.mutate(m.id)}
              aria-label="Remove member"
              className="rounded-lg p-1.5 text-dim ring-1 ring-border transition-colors hover:text-rose"
            >
              <Trash2 className="size-3.5" />
            </button>
          </>
        )}
      </motion.div>
    );
  }

  function Section({ title, rows }: { title: string; rows: Row[] }) {
    return (
      <section className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">{title}</p>
          <span className="h-px flex-1 bg-border" />
          <p className="font-mono text-[10px] text-faint">{rows.length}</p>
        </div>
        {rows.length === 0 ? (
          <p className="py-3 font-mono text-[11px] text-faint">Nothing here.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((m) => (
              <Person key={m.id} m={m} />
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="mt-4">
      <GrantAccess />
      <Section title="Join requests" rows={pending} />
      <Section title="Members" rows={approved} />
      {others.length > 0 && <Section title="Declined / removed" rows={others} />}
    </div>
  );
}

/** Moderator-side: add anyone by email and hand out elevated access. */
function GrantAccess() {
  const { batchId } = useBatch();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"student" | "mod" | "admin">("student");
  const [siteAdmin, setSiteAdmin] = useState(false);

  const grant = useMutation({
    mutationFn: async () => {
      if (!batchId) throw new Error("Pick a batch first");
      const target = email.trim().toLowerCase();
      if (!target) throw new Error("Enter an email");
      const { data: profile, error: lookupError } = await supabase
        .from("profiles")
        .select("id, email")
        .ilike("email", target)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (!profile) throw new Error("No account with that email — ask them to sign up first");

      const { error } = await supabase.from("batch_memberships").upsert(
        {
          batch_id: batchId,
          user_id: profile.id,
          role,
          status: "approved",
          decided_at: new Date().toISOString(),
        },
        { onConflict: "batch_id,user_id" },
      );
      if (error) throw error;

      if (siteAdmin && isAdmin) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({ user_id: profile.id, role: "admin" });
        if (roleError && !roleError.message.includes("duplicate")) throw roleError;
      }
    },
    onSuccess: () => {
      setEmail("");
      setSiteAdmin(false);
      queryClient.invalidateQueries({ queryKey: ["batch-members", batchId] });
      toast.success("Access granted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="mb-6 rounded-2xl bg-surface p-4 ring-1 ring-border"
    >
      <div className="flex items-center gap-2">
        <UserPlus className="size-4 text-cyan" />
        <h3 className="font-display text-sm font-semibold">Grant access</h3>
      </div>
      <p className="mt-1 font-mono text-[11px] text-dim">
        People can't request access themselves — add them here.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="someone@learner.manipal.edu"
          className="min-w-[14rem] flex-1 rounded-lg bg-ground px-3 py-2 text-sm text-ink outline-none ring-1 ring-border placeholder:text-faint focus:ring-cyan/50"
        />
        <div className="flex gap-1.5">
          {(["student", "mod", "admin"] as const).map((r) => (
            <motion.button
              key={r}
              whileTap={{ scale: 0.95 }}
              onClick={() => setRole(r)}
              className={`rounded-lg px-2.5 py-2 font-mono text-[11px] uppercase tracking-wide ring-1 transition-colors ${
                role === r ? "bg-cyan/15 text-cyan ring-cyan/40" : "text-dim ring-border"
              }`}
            >
              {r}
            </motion.button>
          ))}
        </div>
        <motion.button
          whileTap={{ scale: 0.96 }}
          disabled={grant.isPending}
          onClick={() => grant.mutate()}
          className="rounded-lg bg-cyan px-4 py-2 font-mono text-[11px] uppercase tracking-wide text-ground disabled:opacity-60"
        >
          {grant.isPending ? "Adding…" : "Add"}
        </motion.button>
      </div>

      {isAdmin && (
        <label className="mt-3 flex items-center gap-2 font-mono text-[11px] text-dim">
          <input
            type="checkbox"
            checked={siteAdmin}
            onChange={(e) => setSiteAdmin(e.target.checked)}
            className="size-3.5 accent-cyan"
          />
          Also make them a site-wide admin (every batch)
        </label>
      )}
    </motion.section>
  );
}
