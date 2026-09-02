import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { db as supabase, backendConfigured } from "@/lib/backend";
import { lovable } from "@/integrations/lovable/index";
import { batchTreeQuery } from "@/lib/batches";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — TAPMI IPM Deadline Board" },
      {
        name: "description",
        content:
          "Sign in to the TAPMI IPM deadline board. Moderators can add, edit and remove deadlines for the batch.",
      },
      { property: "og:title", content: "Sign in — TAPMI IPM Deadline Board" },
      {
        property: "og:description",
        content: "Moderator access to the TAPMI IPM 2026–2031 deadline board.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const fieldClass =
  "w-full rounded-lg bg-ground px-3 py-2 text-sm text-ink ring-1 ring-border outline-none placeholder:text-faint focus:ring-cyan/50";

const ALLOWED_DOMAIN = "learner.manipal.edu";
const isAllowedEmail = (value: string) =>
  value.trim().toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [batchId, setBatchId] = useState("");
  const { data: batches = [] } = useQuery({
    ...batchTreeQuery,
    enabled: backendConfigured,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!backendConfigured) return;
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data.session) navigate({ to: "/", replace: true });
      })
      .catch(() => undefined);
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!backendConfigured) {
      toast.error("Sign-in is temporarily unavailable. Please try again shortly.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/", replace: true });
      } else {
        if (!isAllowedEmail(email)) {
          throw new Error(`Sign-ups are limited to @${ALLOWED_DOMAIN} email addresses.`);
        }
        if (!batchId) {
          throw new Error("Pick the batch you belong to.");
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, batch_id: batchId },
          },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/", replace: true });
        else
          toast.success(
            "Verification link sent — confirm it from your Manipal learner inbox to activate your account.",
          );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    if (!backendConfigured) {
      toast.error("Sign-in is temporarily unavailable. Please try again shortly.");
      return;
    }
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ground px-5 font-body text-ink">
      <div className="pointer-events-none absolute inset-0">
        <div className="aurora-a absolute -left-16 -top-24 h-[380px] w-[520px] rounded-full bg-cyan/20 blur-[120px]" />
        <div className="aurora-b absolute bottom-[-140px] right-[-40px] h-[420px] w-[520px] rounded-full bg-violet/20 blur-[140px]" />
      </div>

      <div className="relative w-full max-w-sm rounded-2xl bg-surface/90 p-6 ring-1 ring-border backdrop-blur-md">
        <Link to="/" className="font-mono text-[11px] uppercase tracking-[0.2em] text-dim">
          ← Back to the board
        </Link>
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-1 font-mono text-[11px] text-faint">
          TAPMI IPM · Batch 2026–2031
        </p>

        <button
          onClick={handleGoogle}
          className="mt-5 w-full rounded-lg bg-surface2 px-3 py-2.5 text-sm font-medium text-ink ring-1 ring-border transition-colors hover:ring-cyan/40"
        >
          Continue with Google
        </button>

        <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === "signup" && (
            <div>
              <label htmlFor="name" className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
                Full name
              </label>
              <input
                id="name"
                className={`${fieldClass} mt-1`}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Arush Gaur"
              />
            </div>
          )}
          {mode === "signup" && (
            <div>
              <label htmlFor="batch" className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
                Your batch
              </label>
              <select
                id="batch"
                required
                className={`${fieldClass} mt-1`}
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
              >
                <option value="">Select your batch…</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.path} · {b.programme_name} · {b.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 font-mono text-[10px] text-faint">
                You'll only ever see this batch's board.
              </p>
            </div>
          )}
          <div>
            <label htmlFor="email" className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              className={`${fieldClass} mt-1`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@learner.manipal.edu"
            />
            {mode === "signup" && (
              <p className="mt-1 font-mono text-[10px] text-faint">
                Only @learner.manipal.edu addresses can register. We'll email you a
                verification link.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="password" className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              className={`${fieldClass} mt-1`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-1 rounded-lg bg-cyan px-4 py-2.5 text-sm font-semibold text-ground ring-1 ring-cyan transition-opacity disabled:opacity-60"
          >
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full font-mono text-[11px] text-dim transition-colors hover:text-cyan"
        >
          {mode === "signin"
            ? "No account yet? Create one"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
