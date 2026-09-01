import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const credsSchema = z.object({
  batchId: z.string().uuid(),
  username: z.string().min(1),
  password: z.string().min(1),
  termId: z.string().min(1),
});

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

export const saveRegistroCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => credsSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertBatchMod(context.supabase as never, context.userId, data.batchId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("batch_registro_credentials").upsert({
      batch_id: data.batchId,
      username: data.username,
      password: data.password,
      term_id: data.termId,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("batches")
      .update({ registro_term_id: data.termId })
      .eq("id", data.batchId);
    return { ok: true };
  });

export const syncTimetableNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ batchId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertBatchMod(context.supabase as never, context.userId, data.batchId);
    const { syncBatch } = await import("@/lib/registro.server");
    try {
      const result = await syncBatch(data.batchId, true);
      return { ok: true, result };
    } catch (err) {
      return { ok: false, result: err instanceof Error ? err.message : String(err) };
    }
  });

export const hasRegistroCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ batchId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertBatchMod(context.supabase as never, context.userId, data.batchId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("batch_registro_credentials")
      .select("batch_id, term_id, updated_at")
      .eq("batch_id", data.batchId)
      .maybeSingle();
    return { configured: !!row, termId: row?.term_id ?? null, updatedAt: row?.updated_at ?? null };
  });
