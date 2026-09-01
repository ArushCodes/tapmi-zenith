import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function BoardHeader() {
  const { user, isModerator } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const initials = (user?.user_metadata?.["full_name"] ?? user?.email ?? "")
    .toString()
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s: string) => s[0]?.toUpperCase())
    .join("");

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="relative z-20">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-lg bg-surface2 ring-1 ring-border">
            <span className="font-display text-sm font-semibold tracking-tight text-cyan">TD</span>
          </div>
          <div className="leading-tight">
            <p className="font-display text-base font-semibold tracking-tight">TAPMI IPM</p>
            <p className="font-mono text-[11px] text-dim">Deadline Board · Batch 2026–2031</p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <BatchSelector />
          {isModerator && (
            <Link
              to="/admin"
              className="hidden items-center gap-2 rounded-lg bg-surface2 px-3 py-2 text-sm font-medium text-ink ring-1 ring-border transition-colors hover:ring-cyan/40 sm:flex"
            >
              <span className="inline-block size-1.5 rounded-full bg-cyan" />
              <span className="font-mono text-[11px] uppercase tracking-wide text-dim">
                Moderator console
              </span>
            </Link>
          )}

          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan/40 to-violet/40 font-display text-sm font-semibold ring-1 ring-border">
                {initials || "IP"}
              </div>
              <button
                onClick={signOut}
                className="rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-dim ring-1 ring-border transition-colors hover:text-rose"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="rounded-lg bg-surface2 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-dim ring-1 ring-border transition-colors hover:text-ink hover:ring-cyan/40"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
