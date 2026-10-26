import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getDisplayDoc } from "@/lib/legal/server";
import { inviteState, isPlausibleInviteToken, suggestHandle } from "@/lib/spotters";

export const dynamic = "force-dynamic";

/** Public: is this invite link usable? Returns only the invitee's first name and the terms to accept. */
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("t");
  if (!isPlausibleInviteToken(token)) return NextResponse.json({ state: "invalid" });
  const { data: invite } = await getSupabaseAdmin()
    .from("spotter_invites")
    .select("name, used_at, revoked_at, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!invite) return NextResponse.json({ state: "invalid" });
  const state = inviteState(invite);
  if (state !== "open") return NextResponse.json({ state });
  const terms = await getDisplayDoc("spotter_terms");
  return NextResponse.json({
    state,
    name: invite.name,
    suggestedHandle: suggestHandle(invite.name),
    terms: { title: terms.title, version: terms.version, path: terms.path },
  });
}
