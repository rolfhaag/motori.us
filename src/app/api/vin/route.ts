import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError, verifyRequestUser } from "@/lib/verifyRequestUser";

/**
 * The one place a full VIN leaves the database for the public site. Allowed
 * only for a logged-in Admin (any build) or the Builder who owns that build.
 * Everyone else -- including logged-out visitors and other Builders -- gets
 * a 403 and keeps seeing the masked VIN.
 *
 *   GET /api/vin?slug=<slug>|id=<uuid>[&check=1]
 * `check=1` only answers "may this viewer unmask?" (no VIN in the reply).
 */
export async function GET(req: NextRequest) {
  let userId: string;
  try {
    ({ privyUserId: userId } = await verifyRequestUser(req));
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }

  const slug = req.nextUrl.searchParams.get("slug");
  const id = req.nextUrl.searchParams.get("id");
  if (!slug && !id) return NextResponse.json({ error: "Missing build." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase.from("users").select("role, banned").eq("id", userId).maybeSingle();
  if (!user || user.banned) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const query = supabase.from("builds").select("vin, builder_id");
  const { data: build } = await (id ? query.eq("id", id) : query.eq("slug", slug as string)).maybeSingle();
  if (!build) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const allowed = user.role === "admin" || (user.role === "builder" && build.builder_id === userId);
  if (!allowed) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  if (req.nextUrl.searchParams.get("check")) return NextResponse.json({ allowed: true });
  return NextResponse.json({ vin: build.vin ?? "" });
}
