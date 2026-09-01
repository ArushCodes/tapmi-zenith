import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { BatchSelector } from "@/components/board/BatchSelector";

const spring = { type: "spring" as const, stiffness: 420, damping: 32 };

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
    <motion.header
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-20"
    >
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-6 py-6 sm:px-8">
        <Link to="/" className="group flex items-center gap-3.5">
          <motion.div
            whileHover={{ rotate: -6, scale: 1.06 }}
            transition={spring}
            className="grid size-10 place-items-center rounded-xl bg-surface2 ring-1 ring-border group-hover:ring-cyan/40"
          >
            <span className="font-display text-sm font-semibold tracking-tight text-cyan">MA</span>
          </motion.div>
          <div className="leading-tight">
            <p className="font-display text-base font-semibold tracking-tight">MAHE Portal</p>
            <p className="font-mono text-[11px] text-dim">Deadlines · Timetable · Attendance</p>
          </div>
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <BatchSelector />
          {isModerator && (
            <motion.div whileHover={{ y: -2 }} transition={spring}>
              <Link
                to="/admin"
                className="hidden items-center gap-2 rounded-xl bg-surface2 px-3.5 py-2.5 text-sm font-medium text-ink ring-1 ring-border transition-colors hover:ring-cyan/40 sm:flex"
              >
                <ShieldCheck className="size-3.5 text-cyan" />
                <span className="font-mono text-[11px] uppercase tracking-wide text-dim">
                  Moderator console
                </span>
              </Link>
            </motion.div>
          )}

          {user ? (
            <div className="flex items-center gap-2.5">
              <motion.div whileHover={{ y: -2 }} transition={spring}>
                <Link
                  to="/profile"
                  aria-label="Your profile"
                  className="flex items-center gap-2.5 rounded-xl bg-surface2/70 py-1.5 pl-1.5 pr-3.5 ring-1 ring-border transition-colors hover:ring-cyan/40"
                >
                  <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan/40 to-violet/40 font-display text-xs font-semibold">
                    {initials || "IP"}
                  </span>
                  <span className="hidden font-mono text-[11px] uppercase tracking-wide text-dim sm:inline">
                    Profile
                  </span>
                </Link>
              </motion.div>
              <button
                onClick={signOut}
                aria-label="Sign out"
                className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 font-mono text-[11px] text-dim ring-1 ring-border transition-colors hover:text-rose hover:ring-rose/30"
              >
                <LogOut className="size-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          ) : (
            <motion.div whileHover={{ y: -2 }} transition={spring}>
              <Link
                to="/auth"
                className="flex items-center gap-2 rounded-xl bg-surface2 px-3.5 py-2.5 font-mono text-[11px] uppercase tracking-wide text-dim ring-1 ring-border transition-colors hover:text-ink hover:ring-cyan/40"
              >
                <UserRound className="size-3.5" /> Sign in
              </Link>
            </motion.div>
          )}
        </div>
      </div>
    </motion.header>
  );
}
