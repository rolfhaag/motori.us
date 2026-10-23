import { randomUUID } from "crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { SITE_URL } from "@/lib/siteUrl";
import { AuthError } from "@/lib/verifyRequestUser";
import { requireAdmin } from "@/lib/requireAdmin";
import { allRecipients, parseScope, postalAddress, recipientsForScopes, type Scope } from "@/lib/follow";
import { MAX_RECIPIENTS_PER_SEND, sendBroadcast } from "@/lib/email/followers";
import { sendEmail, TEAM_EMAIL } from "@/lib/email/send";
import { broadcastEmail } from "@/lib/email/templates";

export const maxDuration = 300;

async function guard(req: NextRequest) {
  try {
    await requireAdmin(req);
    return null;
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

/** Follower counts for the newsletter page. */
export async function GET(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const { data } = await getSupabaseAdmin().from("email_subscriptions").select("email, scope, status");
  const rows = data ?? [];
  const confirmed = rows.filter((r) => r.status === "confirmed");
  const byScope = new Map<string, number>();
  for (const r of confirmed) byScope.set(r.scope, (byScope.get(r.scope) ?? 0) + 1);
  return NextResponse.json({
    uniqueConfirmed: new Set(confirmed.map((r) => r.email)).size,
    pending: rows.filter((r) => r.status === "pending").length,
    unsubscribed: rows.filter((r) => r.status === "unsubscribed").length,
    scopes: [...byScope.entries()].map(([scope, count]) => ({ scope, count })).sort((a, b) => b.count - a.count),
    postalConfigured: Boolean(postalAddress()),
    maxPerSend: MAX_RECIPIENTS_PER_SEND,
  });
}

interface Body {
  action?: string;
  audience?: { kind?: string; value?: string };
  subject?: string;
  lead?: string;
  body?: string;
  buttonLabel?: string;
  buttonUrl?: string;
}

/** Test-send to team@, or send to a follower audience. */
export async function POST(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const b = (await req.json().catch(() => ({}))) as Body;

  const subject = String(b.subject ?? "").trim();
  const lead = String(b.lead ?? "").trim();
  const paragraphs = String(b.body ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
  const buttonLabel = String(b.buttonLabel ?? "").trim() || null;
  const buttonUrl = String(b.buttonUrl ?? "").trim() || null;

  if (!subject || subject.length > 150) return NextResponse.json({ error: "A subject (up to 150 characters) is required." }, { status: 400 });
  if (!lead || lead.length > 200) return NextResponse.json({ error: "A headline (up to 200 characters) is required." }, { status: 400 });
  if (paragraphs.length === 0 || paragraphs.join("").length > 6000) {
    return NextResponse.json({ error: "Write the message body (up to 6,000 characters)." }, { status: 400 });
  }
  if ((buttonLabel && !buttonUrl) || (!buttonLabel && buttonUrl)) {
    return NextResponse.json({ error: "A button needs both a label and a link." }, { status: 400 });
  }
  if (buttonUrl && !/^https:\/\/[^\s]+$/.test(buttonUrl)) {
    return NextResponse.json({ error: "The button link must start with https://." }, { status: 400 });
  }

  if (b.action === "test") {
    const mail = broadcastEmail({
      subject: `[Test] ${subject}`,
      lead,
      paragraphs,
      buttonLabel,
      buttonUrl,
      marketing: {
        reason: "You’re getting this because you follow motori.us.",
        unsubscribeUrl: `${SITE_URL}/unsubscribe?token=test`,
        postalAddress: postalAddress() ?? "(postal address not set yet: set LEGAL_POSTAL_ADDRESS)",
      },
    });
    const res = await sendEmail({ to: TEAM_EMAIL, template: "broadcast-test", ...mail, dedupeKey: `broadcast-test:${randomUUID()}` });
    if (!res.ok) return NextResponse.json({ error: res.error ?? "Test send failed." }, { status: 502 });
    return NextResponse.json({ ok: true, sentTo: TEAM_EMAIL });
  }

  if (b.action !== "send") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (!postalAddress()) {
    return NextResponse.json(
      { error: "Set LEGAL_POSTAL_ADDRESS in Vercel first: commercial email must include a postal address." },
      { status: 400 }
    );
  }

  const kind = b.audience?.kind;
  let recipients;
  if (kind === "all") recipients = await allRecipients();
  else if (kind === "site") recipients = await recipientsForScopes(["site"]);
  else if (kind === "builder" || kind === "build") {
    const scope = parseScope(`${kind}:${String(b.audience?.value ?? "").trim()}`);
    if (!scope) return NextResponse.json({ error: "Enter a valid Builder handle or Build slug." }, { status: 400 });
    recipients = await recipientsForScopes([scope as Scope]);
  } else {
    return NextResponse.json({ error: "Choose an audience." }, { status: 400 });
  }

  if (recipients.length === 0) return NextResponse.json({ error: "No confirmed followers in that audience yet." }, { status: 400 });
  if (recipients.length > MAX_RECIPIENTS_PER_SEND) {
    return NextResponse.json(
      { error: `That audience has ${recipients.length} people; one send is limited to ${MAX_RECIPIENTS_PER_SEND}. Narrow the audience.` },
      { status: 400 }
    );
  }

  const id = randomUUID();
  after(() => sendBroadcast({ id, subject, lead, paragraphs, buttonLabel, buttonUrl, recipients }));
  return NextResponse.json({ ok: true, queued: recipients.length });
}
