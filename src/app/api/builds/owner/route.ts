import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError, verifyRequestUser } from "@/lib/verifyRequestUser";

export const dynamic = "force-dynamic";

/** 200 only when the signed-in user owns the published build with this slug. */
export async function GET(req: NextRequest) {
  let privyUserId: string;
  try {
    ({ privyUserId } = await verifyRequestUser(req));
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing slug." }, { status: 400 });

  const { data: build } = await getSupabaseAdmin()
    .from("builds")
    .select("builder_id")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!build || build.builder_id !== privyUserId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ owner: true });
}
