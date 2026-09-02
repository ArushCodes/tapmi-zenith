import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  BATCH_STORAGE_KEY,
  batchTreeQuery,
  myMembershipsQuery,
  type BatchNode,
  type Membership,
} from "@/lib/batches";

type BatchContextValue = {
  batches: BatchNode[];
  batch: BatchNode | null;
  batchId: string | null;
  setBatchId: (id: string) => void;
  membership: Membership | null;
  memberships: Membership[];
  isMember: boolean;
  isPending: boolean;
  canManage: boolean;
  loading: boolean;
};

const BatchContext = createContext<BatchContextValue | null>(null);

export function BatchProvider({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = useAuth();
  const { data: allBatches = [], isLoading } = useQuery(batchTreeQuery);
  const { data: memberships = [] } = useQuery(myMembershipsQuery(user?.id));

  /** Students only ever see the batch(es) they belong to; global admins see everything. */
  const batches = useMemo(() => {
    if (isAdmin) return allBatches;
    const mine = new Set(
      memberships.filter((m) => m.status === "approved").map((m) => m.batch_id),
    );
    return allBatches.filter((b) => mine.has(b.id));
  }, [allBatches, memberships, isAdmin]);

  const [batchId, setBatchIdState] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(BATCH_STORAGE_KEY);
    if (stored) setBatchIdState(stored);
  }, []);

  useEffect(() => {
    if (batchId || batches.length === 0) return;
    const mine = memberships.find((m) => m.status === "approved");
    setBatchIdState(mine?.batch_id ?? batches[0]!.id);
  }, [batchId, batches, memberships]);

  function setBatchId(id: string) {
    setBatchIdState(id);
    window.localStorage.setItem(BATCH_STORAGE_KEY, id);
  }

  const value = useMemo<BatchContextValue>(() => {
    const batch = batches.find((b) => b.id === batchId) ?? null;
    const membership = memberships.find((m) => m.batch_id === batchId) ?? null;
    const approved = membership?.status === "approved";
    return {
      batches,
      batch,
      batchId: batch?.id ?? null,
      setBatchId,
      membership,
      memberships,
      isMember: approved || isAdmin,
      isPending: membership?.status === "pending",
      canManage:
        isAdmin || (approved && (membership?.role === "mod" || membership?.role === "admin")),
      loading: isLoading,
    };
  }, [batches, batchId, memberships, isAdmin, isLoading]);

  return <BatchContext.Provider value={value}>{children}</BatchContext.Provider>;
}

export function useBatch() {
  const ctx = useContext(BatchContext);
  if (!ctx) throw new Error("useBatch must be used inside BatchProvider");
  return ctx;
}
