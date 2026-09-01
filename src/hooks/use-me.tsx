import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/** Name + greeting helpers so copy across the app can address the user directly. */
export function useMe() {
  const { user, isModerator, isAdmin } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile-name", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, display_name, email")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const raw =
    profile?.display_name ??
    profile?.full_name ??
    (user?.user_metadata?.["full_name"] as string | undefined) ??
    profile?.email ??
    user?.email ??
    "";

  const cleaned = raw.includes("@") ? raw.split("@")[0]!.replace(/[._-]+/g, " ") : raw;
  const firstName = cleaned.trim().split(/\s+/)[0] ?? "";
  const name = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : "";

  const hour = new Date().getHours();
  const partOfDay = hour < 5 ? "Late night" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return {
    user,
    name,
    isSignedIn: !!user,
    isModerator,
    isAdmin,
    /** e.g. "Good evening, Arush" or "Good evening" when signed out. */
    greeting: name ? `${partOfDay}, ${name}` : partOfDay,
    /** e.g. "Arush's" or "your". */
    possessive: name ? `${name}'s` : "your",
  };
}
