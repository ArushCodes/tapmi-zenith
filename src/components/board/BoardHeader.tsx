import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ChevronDown, LogOut, Moon, ShieldCheck, Sun, UserRound } from "lucide-react";
import { db as supabase } from "@/lib/backend";
import { useAuth } from "@/hooks/use-auth";
import { useMe } from "@/hooks/use-me";
import { useTheme } from "@/hooks/use-theme";
import { BatchSelector } from "@/components/board/BatchSelector";
import { GlobalSearch } from "@/components/board/GlobalSearch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


const spring = { type: "spring" as const, stiffness: 420, damping: 32 };

export type HeaderMenuItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | undefined;
};

type Props = {
  /** Secondary board sections surfaced from the profile menu instead of the tab bar. */
  menuItems?: HeaderMenuItem[];
  onMenuSelect?: (key: string) => void;
};

export function BoardHeader({ menuItems = [], onMenuSelect }: Props) {
  const { user, isModerator } = useAuth();
  const me = useMe();
  const { theme, toggle } = useTheme();

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
      className="sticky top-0 z-30 border-b border-border bg-ground/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-3 px-5 sm:gap-4 sm:px-8">
        <Link to="/" className="group flex min-w-0 items-center">
          <motion.div whileHover={{ scale: 1.03 }} transition={spring} className="min-w-0 leading-none">
            <p className="truncate font-display text-2xl font-extrabold uppercase italic tracking-[-0.03em] text-cyan sm:text-[28px]">
              Zenith
            </p>
            <p className="mt-0.5 hidden font-mono text-[10px] uppercase tracking-[0.18em] text-faint sm:block">
              TAPMI Manipal · MAHE
            </p>
          </motion.div>
        </Link>


        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          {user && <GlobalSearch />}
          <BatchSelector />

          <button
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-surface text-dim transition-colors hover:border-cyan/40 hover:text-ink"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>


          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl border border-border bg-surface py-1.5 pl-1.5 pr-2.5 transition-colors hover:border-cyan/40">
                <span className="grid size-7 place-items-center rounded-lg bg-cyan/12 font-display text-[11px] font-semibold text-cyan">
                  {initials || "Z"}
                </span>
                <span className="hidden max-w-[110px] truncate text-[13px] font-medium sm:inline">
                  {me.name || "Account"}
                </span>
                <ChevronDown className="size-3.5 text-faint" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                  Account
                </DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center gap-2">
                    <UserRound className="size-4 text-dim" /> Profile
                  </Link>
                </DropdownMenuItem>
                {isModerator && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-dim" /> Moderator console
                    </Link>
                  </DropdownMenuItem>
                )}

                {menuItems.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                      Batch
                    </DropdownMenuLabel>
                    {menuItems.map((m) => (
                      <DropdownMenuItem
                        key={m.key}
                        onSelect={() => onMenuSelect?.(m.key)}
                        className="flex items-center gap-2"
                      >
                        <span className="text-dim">{m.icon}</span>
                        {m.label}
                        {m.badge ? (
                          <span className="ml-auto rounded-full bg-cyan/15 px-1.5 py-0.5 font-mono text-[10px] leading-none text-cyan">
                            {m.badge}
                          </span>
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void signOut()} className="flex items-center gap-2 text-rose">
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              to="/auth"
              className="flex items-center gap-2 rounded-xl bg-cyan px-3.5 py-2 text-[13px] font-semibold text-white"
            >
              <UserRound className="size-3.5" /> Sign in
            </Link>
          )}
        </div>
      </div>
    </motion.header>
  );
}
