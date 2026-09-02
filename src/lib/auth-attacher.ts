import { createMiddleware } from "@tanstack/react-start";
import { db } from "@/lib/backend";

/** Attach the session from the same fallback-aware client used by the app. */
export const attachBackendAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await db.auth.getSession();
    const token = data.session?.access_token;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);