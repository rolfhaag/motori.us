import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError } from "@/lib/verifyRequestUser";
import { requireAdmin } from "@/lib/requireAdmin";
import { signApplicationPhotoUrls } from "@/lib/applicationPhotos";

const ACTIVE_APPLICATION_STATUSES = ["submitted", "denied_resubmit"];
const ACTIVE_BUILD_STATUSES = ["submitted"];

/**
 * Everything the Admin dashboard needs in one call: applications and builds
 * sorted so the oldest undecided item is first (per spec), plus the full
 * user and builder lists for the ban/hide tables.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();

  // Drafts aren't submitted yet -- nothing for Admin to act on, so they're
  // left out of the queue entirely.
  const { data: applications } = await supabase
    .from("applications")
    .select("*")
    .neq("status", "draft")
    .order("created_at", { ascending: true });

  // Drafts aren't submitted yet -- nothing for Admin to act on, same as
  // application drafts above.
  const { data: builds } = await supabase
    .from("builds")
    .select("*")
    .neq("status", "draft")
    .order("created_at", { ascending: true });

  const { data: users } = await supabase
    .from("users")
    .select("id, email, role, banned")
    .order("created_at", { ascending: true });

  const { data: builders } = await supabase
    .from("builders")
    .select("*")
    .order("created_at", { ascending: true });

  // Undecided items first (oldest of those first, already satisfied by the
  // ascending sort above), decided/terminal items after.
  // Nominated applicants jump to the top of the undecided queue (still oldest
  // first within each group; Array.sort is stable).
  const sortApplications = [...(applications ?? [])].sort((a, b) => {
    const aActive = ACTIVE_APPLICATION_STATUSES.includes(a.status) ? 0 : 1;
    const bActive = ACTIVE_APPLICATION_STATUSES.includes(b.status) ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    if (aActive === 0) return (a.nominated_by || a.spotter_id ? 0 : 1) - (b.nominated_by || b.spotter_id ? 0 : 1);
    return 0;
  });
  const sortBuilds = [...(builds ?? [])].sort((a, b) => {
    const aActive = ACTIVE_BUILD_STATUSES.includes(a.status) ? 0 : 1;
    const bActive = ACTIVE_BUILD_STATUSES.includes(b.status) ? 0 : 1;
    return aActive - bActive;
  });

  const handleByUser = new Map((builders ?? []).map((b) => [b.user_id, b.handle]));
  const { data: spotterRows } = await supabase.from("spotters").select("id, handle, display_name");
  const spotterById = new Map((spotterRows ?? []).map((sp) => [sp.id, `Spotter ${sp.display_name} (@${sp.handle})`]));
  const applicationsWithUrls = await Promise.all(
    sortApplications.map(async (app) => ({
      ...app,
      nominated_by_handle: app.nominated_by
        ? (handleByUser.get(app.nominated_by) ?? null)
        : app.spotter_id
          ? (spotterById.get(app.spotter_id) ?? null)
          : null,
      photoUrls: await signApplicationPhotoUrls(app.photos ?? []),
    }))
  );

  return NextResponse.json({
    applications: applicationsWithUrls,
    // Never ship password hashes (or the large draft body) to the browser.
    builds: sortBuilds.map(
      ({ access_password_hash: _h, draft_input_hash: _i, draft_content: _c, ...rest }) => rest
    ),
    users: users ?? [],
    builders: builders ?? [],
  });
}
