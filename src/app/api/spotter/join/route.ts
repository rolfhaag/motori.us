import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError, verifyRequestUser } from "@/lib/verifyRequestUser";
import { isHandleAvailable, isValidHandleFormat, normalizeHandle } from "@/lib/builderHandle";
import { cleanDisplayName } from "@/lib/names";
import { recordAcceptances } from "@/lib/legal/server";
import { getSpotterByUser, inviteState, isPlausibleInviteToken, normalizeSocial } from "@/lib/spotters";

export const dynamic = "force-dynamic";

/** A signed-in person finishes Spotter setup with an invite token. */
export async function POST(req: NextRequest) {
  let userId: string;
  try {
    ({ privyUserId: userId } = await verifyRequestUser(req));
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
  const body = await req.json().catch(() => ({}));
  const supabase = getSupabaseAdmin();

  if (await getSpotterByUser(userId)) {
    return NextResponse.json({ error: "You're already a Spotter.", code: "already_spotter" }, { status: 409 });
  }

  const token = body.token;
  if (!isPlausibleInviteToken(token)) return NextResponse.json({ error: "This invite link isn't valid." }, { status: 400 });
  const { data: invite } = await supabase
    .from("spotter_invites")
    .select("id, used_at, revoked_at, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!invite || inviteState(invite) !== "open") {
    return NextResponse.json({ error: "This invite link has already been used or has expired. Ask for a new one." }, { status: 410 });
  }

  const handle = normalizeHandle(String(body.handle ?? ""));
  if (!isValidHandleFormat(handle)) {
    return NextResponse.json({ error: "Handle must be 3-30 characters: lowercase letters, numbers, and hyphens only." }, { status: 400 });
  }
  const displayName = cleanDisplayName(body.displayName);
  if (!displayName) return NextResponse.json({ error: "Display name must be 2 to 40 characters." }, { status: 400 });
  const social = normalizeSocial(body.socialUrl);
  if (social === undefined) return NextResponse.json({ error: "That link doesn't look right. Use a full https link or an @handle." }, { status: 400 });
  if (!(await isHandleAvailable(handle, undefined, userId))) {
    return NextResponse.json({ error: "That handle is already taken. Please choose another." }, { status: 409 });
  }

  const termsVersion = String(body.termsVersion ?? "");
  if (!termsVersion) return NextResponse.json({ error: "Please accept the Spotter Terms to continue." }, { status: 400 });
  const accepted = await recordAcceptances(req, userId, [{ type: "spotter_terms", version: termsVersion }], "spotter_setup");
  if (!accepted.ok) return NextResponse.json({ error: accepted.error }, { status: 409 });

  const { data: spotter, error } = await supabase
    .from("spotters")
    .insert({ user_id: userId, handle, display_name: displayName, social_url: social })
    .select("id")
    .single();
  if (error || !spotter) {
    return NextResponse.json({ error: error?.message ?? "Could not finish setup." }, { status: 500 });
  }
  // Claim the invite (single use). If someone beat us to it, undo.
  const { data: claimed } = await supabase
    .from("spotter_invites")
    .update({ used_at: new Date().toISOString(), used_by: userId })
    .eq("id", invite.id)
    .is("used_at", null)
    .is("revoked_at", null)
    .select("id");
  if (!claimed || claimed.length === 0) {
    await supabase.from("spotters").delete().eq("id", spotter.id);
    return NextResponse.json({ error: "This invite link was just used. Ask for a new one." }, { status: 410 });
  }
  return NextResponse.json({ ok: true, handle });
}
