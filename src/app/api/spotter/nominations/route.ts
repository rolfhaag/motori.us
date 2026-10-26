import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError } from "@/lib/verifyRequestUser";
import { requireSpotter } from "@/lib/spotters";
import { NOMINATIONS_PER_DAY, newNominationToken, nominationUrl } from "@/lib/nominations";

export const dynamic = "force-dynamic";

async function who(req: NextRequest) {
  try {
    return await requireSpotter(req);
  } catch (err) {
    if (err instanceof AuthError) return { error: NextResponse.json({ error: err.message }, { status: err.status }) };
    return { error: NextResponse.json({ error: "Unexpected error." }, { status: 500 }) };
  }
}

/** A Spotter nominates a specific car: a one-person link plus a short note about the car. */
export async function POST(req: NextRequest) {
  const w = await who(req);
  if ("error" in w) return w.error;
  const body = await req.json().catch(() => ({}));
  const note = String(body.note ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || null;

  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("nominations")
    .select("id", { count: "exact", head: true })
    .eq("spotter_id", w.spotter.id)
    .gte("created_at", since);
  if ((count ?? 0) >= NOMINATIONS_PER_DAY) {
    return NextResponse.json({ error: "That's a lot of nominations for one day. Try again tomorrow." }, { status: 429 });
  }
  const token = newNominationToken();
  const { data, error } = await supabase
    .from("nominations")
    .insert({ token, spotter_id: w.spotter.id, car_note: note })
    .select("id")
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Couldn't make your link." }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id, url: nominationUrl(token), name: w.spotter.display_name, note });
}

/** Delete one of my nominations that nobody has used yet. */
export async function DELETE(req: NextRequest) {
  const w = await who(req);
  if ("error" in w) return w.error;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const { data } = await getSupabaseAdmin()
    .from("nominations")
    .delete()
    .eq("id", id)
    .eq("spotter_id", w.spotter.id)
    .is("claimed_application_id", null)
    .select("id");
  if (!data || data.length === 0) return NextResponse.json({ error: "That one can't be deleted." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
