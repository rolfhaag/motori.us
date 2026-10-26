import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError } from "@/lib/verifyRequestUser";
import { requireAdmin } from "@/lib/requireAdmin";
import { normalizeEmail } from "@/lib/follow";
import { sendSpotterInviteEmail } from "@/lib/email/spotterNotify";
import { INVITE_TTL_DAYS, inviteDmText, inviteState, inviteUrl, newInviteToken } from "@/lib/spotters";

export const dynamic = "force-dynamic";

async function guard(req: NextRequest) {
  try {
    return { adminId: (await requireAdmin(req)).privyUserId };
  } catch (err) {
    if (err instanceof AuthError) return { error: NextResponse.json({ error: err.message }, { status: err.status }) };
    return { error: NextResponse.json({ error: "Unexpected error." }, { status: 500 }) };
  }
}

/** Spotters (with their counts) and every invite. */
export async function GET(req: NextRequest) {
  const g = await guard(req);
  if ("error" in g) return g.error;
  const supabase = getSupabaseAdmin();

  const { data: spotters } = await supabase
    .from("spotters")
    .select("id, user_id, handle, display_name, social_url, status, created_at")
    .order("created_at", { ascending: true });
  const ids = (spotters ?? []).map((s) => s.id);
  const [{ data: brought }, { data: spotted }, { data: noms }] = ids.length
    ? await Promise.all([
        supabase.from("builders").select("brought_by_spotter_id").in("brought_by_spotter_id", ids),
        supabase.from("builds").select("spotted_by_spotter_id").in("spotted_by_spotter_id", ids).eq("status", "published"),
        supabase.from("nominations").select("spotter_id").in("spotter_id", ids),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const count = (rows: Record<string, string | null>[] | null, key: string, id: string) =>
    (rows ?? []).filter((r) => r[key] === id).length;

  const { data: invites } = await supabase
    .from("spotter_invites")
    .select("id, token, name, email, created_at, expires_at, used_at, revoked_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return NextResponse.json({
    spotters: (spotters ?? []).map((s) => ({
      ...s,
      builders: count(brought, "brought_by_spotter_id", s.id),
      builds: count(spotted, "spotted_by_spotter_id", s.id),
      nominations: count(noms, "spotter_id", s.id),
    })),
    invites: (invites ?? []).map((i) => {
      const state = inviteState(i);
      const url = inviteUrl(i.token);
      return {
        id: i.id,
        name: i.name,
        email: i.email,
        created_at: i.created_at,
        expires_at: i.expires_at,
        state,
        url: state === "open" ? url : null,
        dm: state === "open" ? inviteDmText(i.name, url) : null,
      };
    }),
  });
}

/**
 * action: "invite" { name?, email? } | "revoke_invite" { id } |
 *         "set_status" { id, status } | "clear_credit" { kind: "builder" | "build", id }
 */
export async function POST(req: NextRequest) {
  const g = await guard(req);
  if ("error" in g) return g.error;
  const body = await req.json().catch(() => ({}));
  const supabase = getSupabaseAdmin();

  if (body.action === "invite") {
    const name = String(body.name ?? "").replace(/[<>]/g, "").trim().slice(0, 60) || null;
    const emailRaw = String(body.email ?? "").trim();
    const email = emailRaw ? normalizeEmail(emailRaw) : null;
    if (emailRaw && !email) return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });

    const token = newInviteToken();
    const expires = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: row, error } = await supabase
      .from("spotter_invites")
      .insert({ token, name, email, created_by: g.adminId, expires_at: expires })
      .select("id")
      .single();
    if (error || !row) return NextResponse.json({ error: error?.message ?? "Could not create the invite." }, { status: 500 });

    const url = inviteUrl(token);
    let emailed = false;
    if (email) emailed = (await sendSpotterInviteEmail(email, name, url, row.id)).ok;
    return NextResponse.json({ ok: true, id: row.id, url, dm: inviteDmText(name, url), emailed, name });
  }

  if (body.action === "revoke_invite") {
    await supabase
      .from("spotter_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", String(body.id ?? ""))
      .is("used_at", null)
      .is("revoked_at", null);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_status") {
    if (body.status !== "active" && body.status !== "revoked") {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    const { error } = await supabase.from("spotters").update({ status: body.status }).eq("id", String(body.id ?? ""));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "clear_credit") {
    const id = String(body.id ?? "");
    const q =
      body.kind === "builder"
        ? supabase.from("builders").update({ brought_by_spotter_id: null }).eq("user_id", id)
        : body.kind === "build"
          ? supabase.from("builds").update({ spotted_by_spotter_id: null }).eq("id", id)
          : null;
    if (!q) return NextResponse.json({ error: "Invalid credit." }, { status: 400 });
    const { error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
