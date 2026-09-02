import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import { db as supabase } from "@/lib/backend";
import { useAuth } from "@/hooks/use-auth";
import { useMe } from "@/hooks/use-me";
import { BatchSelector } from "@/components/board/BatchSelector";

const spring = { type: "spring" as const, stiffness: 420, damping: 32 };

export function BoardHeader() {
  const { user, isModerator } = useAuth();
  const me = useMe();
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
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-5 py-5 sm:gap-4 sm:px-8 sm:py-6">
        <Link to="/" className="group flex min-w-0 items-center gap-2.5 sm:gap-3.5">
          <motion.div
            whileHover={{ rotate: -6, scale: 1.06 }}
            transition={spring}
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface2 ring-1 ring-border group-hover:ring-cyan/40 sm:size-10"
          >
            <span className="font-display text-xs font-semibold tracking-tight text-cyan sm:text-sm">
              TM
            </span>
          </motion.div>
          <div className="min-w-0 leading-tight">
            <p className="truncate font-display text-sm font-semibold tracking-tight sm:text-base">
              TAPMI Manipal
            </p>
            <p className="hidden font-mono text-[11px] text-dim sm:block">
              Deadlines · Timetable · Attendance
            </p>
          </div>
        </Link>

        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
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
                    {me.name || "Profile"}
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
