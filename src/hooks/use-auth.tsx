import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { db as supabase, backendConfigured } from "@/lib/backend";

export type AppRole = "student" | "mod" | "admin";

type SessionValue = { session: Session | null; user: User | null; loading: boolean };

const SessionContext = createContext<SessionValue | null>(null);

/** Single auth listener for the whole app — without this every component that
 *  calls useAuth() opens its own getSession() round-trip on mount. */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const value = useSessionInternal();
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  // Fallback keeps standalone usage (tests, isolated trees) working.
  const local = useSessionInternal(!!ctx);
  return ctx ?? local;
}

function useSessionInternal(skip = false) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(backendConfigured);

  useEffect(() => {
    if (skip) return undefined;
    if (!backendConfigured) {
      setSession(null);
      setLoading(false);
      return undefined;
    }
    try {
      const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
        setSession(next);
        setLoading(false);
      });
      void supabase.auth
        .getSession()
        .then(({ data }) => setSession(data.session))
        .catch(() => setSession(null))
        .finally(() => setLoading(false));
      return () => sub.subscription.unsubscribe();
    } catch (error) {
      // Keep public pages usable if authentication initialization fails.
      console.error("Authentication initialization failed", error);
      setSession(null);
      setLoading(false);
      return undefined;
    }
  }, [skip]);

  return useMemo(
    () => ({ session, user: (session?.user ?? null) as User | null, loading }),
    [session, loading],
  );
}

export function useAuth() {
  const { session, user, loading } = useSession();

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["roles", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      return data.map((r) => r.role as AppRole);
    },
  });

  const isModerator = roles.includes("mod") || roles.includes("admin");

  return {
    session,
    user,
    roles,
    isModerator,
    isAdmin: roles.includes("admin"),
    loading: loading || (!!user && rolesLoading),
  };
}
