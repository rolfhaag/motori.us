import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError, verifyRequestUser } from "@/lib/verifyRequestUser";
import { signApplicationPhotoUrls } from "@/lib/applicationPhotos";

/**
 * One consolidated "who am I and where do I stand" call, used by the account
 * pill and the /apply page: role, and (if present) the applicant's current
 * application plus signed photo URLs, or their Builder profile.
 */
export async function GET(req: NextRequest) {
  let privyUserId: string;
  try {
    ({ privyUserId } = await verifyRequestUser(req));
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();

  const { data: dbUser } = await supabase
    .from("users")
    .select("role, email, banned")
    .eq("id", privyUserId)
    .maybeSingle();

  const { data: application } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", privyUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: builder } = await supabase
    .from("builders")
    .select("handle, display_name, description, socials, hidden, brought_by_spotter_id, spotter_credit_answered")
    .eq("user_id", privyUserId)
    .maybeSingle();

  // The Spotter who brought this Builder in (for the "credit your Spotter?" question),
  // and whether this person is a Spotter themselves (for the account menu).
  let broughtBy: { name: string; handle: string; ask: boolean } | null = null;
  if (builder?.brought_by_spotter_id) {
    const { data: sp } = await supabase
      .from("spotters")
      .select("handle, display_name, status")
      .eq("id", builder.brought_by_spotter_id)
      .maybeSingle();
    if (sp && sp.status === "active") {
      broughtBy = { name: sp.display_name, handle: sp.handle, ask: !builder.spotter_credit_answered };
    }
  }
  const { data: ownSpotter } = await supabase.from("spotters").select("status").eq("user_id", privyUserId).maybeSingle();

  let applicationWithUrls = null;
  if (application) {
    const photoUrls = await signApplicationPhotoUrls(application.photos ?? []);
    applicationWithUrls = { ...application, photoUrls };
  }

  return NextResponse.json({
    role: dbUser?.role ?? "applicant",
    email: dbUser?.email ?? null,
    banned: dbUser?.banned ?? false,
    application: applicationWithUrls,
    builder: builder ?? null,
    broughtBy,
    isSpotter: ownSpotter?.status === "active",
  });
}
