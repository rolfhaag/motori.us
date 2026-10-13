import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError } from "@/lib/verifyRequestUser";
import { requireBuilder } from "@/lib/requireBuilder";
import { displayName } from "@/lib/builderListings";
import { NOMINATIONS_PER_DAY, isPlausibleToken, newNominationToken, nominationUrl } from "@/lib/nominations";

export const dynamic = "force-dynamic";

/** A Builder mints a personal nomination link. One link = one nomination. */
export async function POST(req: NextRequest) {
  let builderId: string;
  let handle: string;
  try {
    ({ builderId, handle } = await requireBuilder(req));
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("nominations")
    .select("id", { count: "exact", head: true })
    .eq("builder_id", builderId)
    .gte("created_at", since);
  if ((count ?? 0) >= NOMINATIONS_PER_DAY) {
    return NextResponse.json({ error: "That's a lot of nominations for one day. Try again tomorrow." }, { status: 429 });
  }

  const token = newNominationToken();
  const { error } = await supabase.from("nominations").insert({ token, builder_id: builderId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, token, url: nominationUrl(token), name: displayName(handle) });
}

/** Public: who sent this link? Only the Builder's display name comes back. */
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!isPlausibleToken(token)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const supabase = getSupabaseAdmin();
  const { data: nomination } = await supabase
    .from("nominations")
    .select("builder_id")
    .eq("token", token)
    .maybeSingle();
  if (!nomination) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: builder } = await supabase
    .from("builders")
    .select("handle")
    .eq("user_id", nomination.builder_id)
    .maybeSingle();
  if (!builder) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({ name: displayName(builder.handle) });
}
