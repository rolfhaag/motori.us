import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Sends one email through Resend and records it in email_log.
 *
 * - Never throws: a failed email must never break an approval, a submission
 *   or any other action. Failures are logged (email_log.status = 'failed').
 * - Idempotent: when a dedupeKey is given, the same event can't email twice.
 *   An already-sent key is skipped; a previously failed one is retried.
 */

const RESEND_URL = "https://api.resend.com/emails";
const STALE_PENDING_MS = 10 * 60 * 1000;

export const FROM_ADDRESS = process.env.EMAIL_FROM || "motori.us <team@motori.us>";
export const REPLY_TO = process.env.EMAIL_REPLY_TO || "team@motori.us";
export const TEAM_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || "team@motori.us";

export interface SendArgs {
  to: string;
  template: string;
  subject: string;
  html: string;
  text: string;
  dedupeKey?: string;
}

export interface SendResult {
  ok: boolean;
  skipped?: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const { to, template, subject, html, text, dedupeKey } = args;
  let logId: string | null = null;
  try {
    const supabase = getSupabaseAdmin();

    if (dedupeKey) {
      const { data: existing } = await supabase
        .from("email_log")
        .select("id, status, created_at")
        .eq("dedupe_key", dedupeKey)
        .maybeSingle();
      if (existing) {
        const inFlight =
          existing.status === "pending" &&
          Date.now() - new Date(existing.created_at).getTime() < STALE_PENDING_MS;
        if (existing.status === "sent" || inFlight) return { ok: true, skipped: true };
        logId = existing.id;
        await supabase
          .from("email_log")
          .update({ status: "pending", error: null, subject, to_email: to })
          .eq("id", logId);
      }
    }

    if (!logId) {
      const { data: row, error: insertError } = await supabase
        .from("email_log")
        .insert({ dedupe_key: dedupeKey ?? null, template, to_email: to, subject, status: "pending" })
        .select("id")
        .single();
      if (insertError) {
        // A parallel request won the unique key: treat as already handled.
        if ((insertError as { code?: string }).code === "23505") return { ok: true, skipped: true };
        console.error("[email] could not write email_log:", insertError.message);
      } else {
        logId = row.id;
      }
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      await finish(logId, { status: "failed", error: "RESEND_API_KEY is not set." });
      return { ok: false, error: "RESEND_API_KEY is not set." };
    }

    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(dedupeKey ? { "Idempotency-Key": dedupeKey.slice(0, 250) } : {}),
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        reply_to: REPLY_TO,
        subject,
        html,
        text,
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as { id?: string; message?: string };

    if (!res.ok) {
      const error = payload.message || `Resend returned ${res.status}.`;
      await finish(logId, { status: "failed", error });
      console.error("[email] send failed:", template, error);
      return { ok: false, error };
    }

    await finish(logId, { status: "sent", provider_id: payload.id ?? null, sent_at: new Date().toISOString() });
    return { ok: true, id: payload.id };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown email error.";
    console.error("[email] unexpected error:", template, error);
    await finish(logId, { status: "failed", error }).catch(() => {});
    return { ok: false, error };
  }
}

async function finish(logId: string | null, fields: Record<string, unknown>) {
  if (!logId) return;
  try {
    await getSupabaseAdmin().from("email_log").update(fields).eq("id", logId);
  } catch {
    // Logging is best-effort.
  }
}
