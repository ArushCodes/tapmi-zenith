import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabase as generatedClient } from "@/integrations/supabase/client";

// Public (publishable) backend coordinates. These are safe to ship to the browser
// and act as a fallback when build-time env injection is missing in a deployed bundle.
const FALLBACK_URL = "https://puniebpooajksnbmfbaj.supabase.co";
const FALLBACK_KEY = "sb_publishable_R5Nq0Yw3iQIb76SVnl7yWQ_q2QoU28u";

const envUrl = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const envKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;

const hasEnv = Boolean(envUrl && envKey);

function createFallbackClient() {
  const key = envKey || FALLBACK_KEY;
  return createClient<Database>(envUrl || FALLBACK_URL, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(
          typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
        );
        if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
        if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

let fallback: ReturnType<typeof createFallbackClient> | undefined;

/** Backend is always reachable: env-injected when available, public fallback otherwise. */
export const backendConfigured = true;

/** Supabase client that never throws for a missing build-time env var. */
export const db = new Proxy({} as ReturnType<typeof createFallbackClient>, {
  get(_, prop, receiver) {
    if (hasEnv) return Reflect.get(generatedClient as never, prop, receiver);
    if (!fallback) fallback = createFallbackClient();
    return Reflect.get(fallback, prop, receiver);
  },
});
