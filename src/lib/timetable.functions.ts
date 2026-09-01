import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSafeFeedUrl } from "@/lib/safe-url";

async function assertBatchMod(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> },
  userId: string,
  batchId: string,
) {
  const { data } = await supabase.rpc("is_batch_mod", {
    _user_id: userId,
    _batch_id: batchId,
  });
  if (data !== true) throw new Error("Forbidden — moderators only");
}

export const saveIcsUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        batchId: z.string().uuid(),
        icsUrl: z
          .string()
          .max(2048)
          .transform((v) => v.trim())
          .refine((v) => {
            try {
              assertSafeFeedUrl(v);
              return true;
            } catch {
              return false;
            }
          }, "Enter a public https calendar (.ics) link"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertBatchMod(context.supabase as never, context.userId, data.batchId);
    const safeUrl = assertSafeFeedUrl(data.icsUrl).toString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("batches")
      .update({ ics_url: safeUrl })
      .eq("id", data.batchId);
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("batch_sync_state")
      .upsert({ batch_id: data.batchId, paused: false, consecutive_failures: 0, last_error: null });
    return { ok: true };
  });

export const syncTimetableNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ batchId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertBatchMod(context.supabase as never, context.userId, data.batchId);
    const { syncBatch } = await import("@/lib/ics-sync.server");
    try {
      const result = await syncBatch(data.batchId, true);
      return { ok: true, result };
    } catch (err) {
      return { ok: false, result: err instanceof Error ? err.message : String(err) };
    }
  });
