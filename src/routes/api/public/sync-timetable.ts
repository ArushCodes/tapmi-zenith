import { createFileRoute } from "@tanstack/react-router";

/** Scheduled Registro timetable sync. Called by the scheduler with the cron secret. */
export const Route = createFileRoute("/api/public/sync-timetable")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["LOVABLE_CRON_SECRET"];
        const provided =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace("Bearer ", "");
        if (!secret || provided !== secret) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncBatch } = await import("@/lib/registro.server");

        const { data: creds } = await supabaseAdmin
          .from("batch_registro_credentials")
          .select("batch_id")
          .limit(10);

        const results: { batch_id: string; result: string }[] = [];
        for (const row of creds ?? []) {
          try {
            results.push({ batch_id: row.batch_id, result: await syncBatch(row.batch_id) });
          } catch (err) {
            results.push({
              batch_id: row.batch_id,
              result: `error: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
        }

        return Response.json({ ok: true, batches: results.length, results });
      },
    },
  },
});
