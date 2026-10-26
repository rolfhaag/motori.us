import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError } from "@/lib/verifyRequestUser";
import { requireSpotter, nominationStatuses } from "@/lib/spotters";
import { SITE_URL } from "@/lib/siteUrl";
import { nominationUrl } from "@/lib/nominations";

export const dynamic = "force-dynamic";

/** The Spotter's own dashboard data. */
export async function GET(req: NextRequest) {
  let spotter;
  try {
    ({ spotter } = await requireSpotter(req));
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
  const supabase = getSupabaseAdmin();
  const { data: noms } = await supabase
    .from("nominations")
    .select("id, token, car_note, created_at, claimed_application_id")
    .eq("spotter_id", spotter.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const statuses = await nominationStatuses(spotter.id, noms ?? []);

  const [{ count: builders }, { count: builds }] = await Promise.all([
    supabase.from("builders").select("user_id", { count: "exact", head: true }).eq("brought_by_spotter_id", spotter.id).eq("hidden", false),
    supabase
      .from("builds")
      .select("id", { count: "exact", head: true })
      .eq("spotted_by_spotter_id", spotter.id)
      .eq("status", "published")
      .eq("visibility", "public")
      .eq("hidden", false),
  ]);

  return NextResponse.json({
    spotter: { handle: spotter.handle, name: spotter.display_name, social: spotter.social_url, pageUrl: `${SITE_URL}/spotters/${spotter.handle}/` },
    counts: { builders: builders ?? 0, builds: builds ?? 0 },
    nominations: (noms ?? []).map((n) => ({
      id: n.id,
      note: n.car_note,
      createdAt: n.created_at,
      url: nominationUrl(n.token),
      status: statuses.get(n.id)?.status ?? "sent",
      buildUrl: statuses.get(n.id)?.buildUrl ?? null,
    })),
  });
}
