import { NextRequest, NextResponse, after } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { SITE_URL } from "@/lib/siteUrl";
import { AuthError } from "@/lib/verifyRequestUser";
import { requireAdmin } from "@/lib/requireAdmin";
import { isLegalDocType, LEGAL_DOC_TYPES, type LegalDocType } from "@/lib/legal/documents";
import { ensureLegalDocs } from "@/lib/legal/server";
import { sendEmail } from "@/lib/email/send";
import { termsUpdated } from "@/lib/email/templates";

export const maxDuration = 300;

/** Account holders who need to accept `type` (builder terms: Builders and Admins only). */
async function audienceFor(type: LegalDocType, version: string) {
  const supabase = getSupabaseAdmin();
  let q = supabase.from("users").select("id, email, role").eq("banned", false).not("email", "is", null);
  if (type === "builder_terms") q = q.in("role", ["builder", "admin"]);
  const { data: users } = await q;
  const { data: accepted } = await supabase
    .from("legal_acceptances")
    .select("user_id")
    .eq("doc_type", type)
    .eq("version", version);
  const have = new Set((accepted ?? []).map((a) => a.user_id));
  const all = users ?? [];
  return { total: all.length, pending: all.filter((u) => !have.has(u.id)) };
}

/** Document versions on file and how many account holders still have to accept each. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
  const docs = await ensureLegalDocs();
  const out = [];
  for (const type of LEGAL_DOC_TYPES) {
    const d = docs[type];
    const aud = await audienceFor(type, d.version);
    out.push({
      type,
      title: d.title,
      version: d.version,
      effectiveDate: d.effectiveDate,
      changeSummary: d.changeSummary,
      path: d.path,
      accountHolders: aud.total,
      notAccepted: aud.pending.length,
    });
  }
  return NextResponse.json({ docs: out });
}

/** Email the "we've updated our terms" notice to everyone who hasn't accepted the current version. */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
  const body = await req.json().catch(() => ({}));
  if (body?.action !== "notify" || !isLegalDocType(body?.type)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const type = body.type as LegalDocType;
  const doc = (await ensureLegalDocs())[type];
  const aud = await audienceFor(type, doc.version);
  const mail = termsUpdated({
    items: [{ title: doc.title, version: doc.version, summary: doc.changeSummary, url: `${SITE_URL}${doc.path}` }],
    actionUrl: `${SITE_URL}/builder`,
  });
  const recipients = aud.pending.filter((u): u is typeof u & { email: string } => Boolean(u.email));
  after(async () => {
    for (const u of recipients) {
      await sendEmail({
        to: u.email,
        template: "terms-updated",
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        dedupeKey: `terms-notice:${type}:${doc.version}:${u.id}`,
      });
      await new Promise((r) => setTimeout(r, 600));
    }
  });
  return NextResponse.json({ ok: true, queued: recipients.length });
}
