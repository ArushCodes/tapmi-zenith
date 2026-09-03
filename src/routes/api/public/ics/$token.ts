import { createFileRoute } from "@tanstack/react-router";

function stamp(d: Date) {
  return `${d.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function esc(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/** Subscribable calendar feed for a batch: classes + approved deadlines. */
export const Route = createFileRoute("/api/public/ics/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token.replace(/\.ics$/, "");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: tokenRow } = await supabaseAdmin
          .from("batch_feed_tokens")
          .select("batch_id")
          .eq("token", token)
          .maybeSingle();
        if (!tokenRow) return new Response("Not found", { status: 404 });

        const { data: batch } = await supabaseAdmin
          .from("batches")
          .select("id, name")
          .eq("id", tokenRow.batch_id)
          .maybeSingle();
        if (!batch) return new Response("Not found", { status: 404 });

        const [{ data: sessions }, { data: deadlines }] = await Promise.all([
          supabaseAdmin
            .from("class_sessions")
            .select("*")
            .eq("batch_id", batch.id)
            .eq("visibility", "batch")
            .order("start_at"),
          supabaseAdmin
            .from("deadlines")
            .select("*")
            .eq("batch_id", batch.id)
            .eq("status", "approved"),
        ]);

        const now = stamp(new Date());
        const lines = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//MAHE Portal//EN",
          "CALSCALE:GREGORIAN",
          "METHOD:PUBLISH",
          `X-WR-CALNAME:${esc(batch.name)}`,
          "X-WR-TIMEZONE:Asia/Kolkata",
        ];

        for (const s of sessions ?? []) {
          lines.push(
            "BEGIN:VEVENT",
            `UID:${s.id}@mahe-portal`,
            `DTSTAMP:${now}`,
            `DTSTART:${stamp(new Date(s.start_at))}`,
            `DTEND:${stamp(new Date(s.end_at))}`,
            `SUMMARY:${esc(s.title)}`,
            `DESCRIPTION:${esc(
              [
                s.course_name && `Course: ${s.course_name}`,
                s.faculty_name && `Faculty: ${s.faculty_name}`,
                s.section && `Section: ${s.section}`,
              ]
                .filter(Boolean)
                .join("\n"),
            )}`,
            `LOCATION:${esc(s.classroom ?? "")}`,
            "STATUS:CONFIRMED",
            "END:VEVENT",
          );
        }

        for (const d of deadlines ?? []) {
          const start = new Date(d.due_at);
          lines.push(
            "BEGIN:VEVENT",
            `UID:${d.id}@mahe-portal-deadline`,
            `DTSTAMP:${now}`,
            `DTSTART:${stamp(start)}`,
            `DTEND:${stamp(new Date(start.getTime() + 3600_000))}`,
            `SUMMARY:${esc(`${d.subject_code ? `${d.subject_code} · ` : ""}${d.title}`)}`,
            `DESCRIPTION:${esc([d.subject, d.type, d.notes].filter(Boolean).join(" — "))}`,
            `LOCATION:${esc(d.location ?? "")}`,
            "END:VEVENT",
          );
        }

        lines.push("END:VCALENDAR");

        return new Response(lines.join("\r\n"), {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Cache-Control": "public, max-age=900",
          },
        });
      },
    },
  },
});
