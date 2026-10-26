import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError } from "@/lib/verifyRequestUser";
import { requireBuilder } from "@/lib/requireBuilder";
import { builderName } from "@/lib/names";
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

  return NextResponse.json({ ok: true, token, url: nominationUrl(token), name: await builderName(handle) });
}

/** Public: who sent this link? Only the sender's display name (and a Spotter's note about the car) comes back. */
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!isPlausibleToken(token)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const supabase = getSupabaseAdmin();
  const { data: nomination } = await supabase
    .from("nominations")
    .select("builder_id, spotter_id, car_note")
    .eq("token", token)
    .maybeSingle();
  if (!nomination) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (nomination.spotter_id) {
    const { data: spotter } = await supabase
      .from("spotters")
      .select("display_name, status")
      .eq("id", nomination.spotter_id)
      .maybeSingle();
    if (!spotter || spotter.status !== "active") return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ kind: "spotter", name: spotter.display_name, note: nomination.car_note ?? null });
  }

  const { data: builder } = await supabase
    .from("builders")
    .select("handle")
    .eq("user_id", nomination.builder_id)
    .maybeSingle();
  if (!builder) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({ kind: "builder", name: await builderName(builder.handle), note: null });
}
