import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError } from "@/lib/verifyRequestUser";
import { requireAdmin } from "@/lib/requireAdmin";
import { TEMPLATE_REGISTRY } from "@/lib/email/templates";
import { heroImageUrl } from "@/lib/email/heroImage";
import { sendEmail, TEAM_EMAIL } from "@/lib/email/send";
import type { BuildPhoto } from "@/lib/buildAssets";

async function authorize(req: NextRequest) {
  try {
    await requireAdmin(req);
    return null;
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

/** The most recent build that has a photo, so previews show a real hero image. */
async function sampleHero(): Promise<string | null> {
  const { data } = await getSupabaseAdmin()
    .from("builds")
    .select("id, photos")
    .order("created_at", { ascending: false })
    .limit(10);
  for (const b of data ?? []) {
    const first = ((b.photos ?? []) as BuildPhoto[])[0];
    if (first) return heroImageUrl("build", b.id, first.path);
  }
  return null;
}

/**
 * GET            -> the list of templates.
 * GET ?id=<id>   -> one template rendered with sample data ({subject, html}).
 */
export async function GET(req: NextRequest) {
  const denied = await authorize(req);
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({
      templates: TEMPLATE_REGISTRY.map((t) => ({ id: t.id, label: t.label, audience: t.audience })),
      testRecipient: TEAM_EMAIL,
    });
  }
  const def = TEMPLATE_REGISTRY.find((t) => t.id === id);
  if (!def) return NextResponse.json({ error: "Unknown template." }, { status: 404 });
  const mail = def.render(await sampleHero());
  return NextResponse.json({ subject: mail.subject, html: mail.html, to: TEAM_EMAIL });
}

/** POST {id}: sends that template, with sample data, to team@motori.us only. */
export async function POST(req: NextRequest) {
  const denied = await authorize(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const def = TEMPLATE_REGISTRY.find((t) => t.id === body.id);
  if (!def) return NextResponse.json({ error: "Unknown template." }, { status: 404 });

  const mail = def.render(await sampleHero());
  const result = await sendEmail({
    to: TEAM_EMAIL,
    template: `test:${def.id}`,
    subject: `[TEST] ${mail.subject}`,
    html: mail.html,
    text: mail.text,
  });
  if (!result.ok) return NextResponse.json({ error: result.error ?? "Send failed." }, { status: 502 });
  return NextResponse.json({ ok: true, to: TEAM_EMAIL });
}
