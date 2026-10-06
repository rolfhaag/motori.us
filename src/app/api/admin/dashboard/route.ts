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
  const sortApplications = [...(applications ?? [])].sort((a, b) => {
    const aActive = ACTIVE_APPLICATION_STATUSES.includes(a.status) ? 0 : 1;
    const bActive = ACTIVE_APPLICATION_STATUSES.includes(b.status) ? 0 : 1;
    return aActive - bActive;
  });
  const sortBuilds = [...(builds ?? [])].sort((a, b) => {
    const aActive = ACTIVE_BUILD_STATUSES.includes(a.status) ? 0 : 1;
    const bActive = ACTIVE_BUILD_STATUSES.includes(b.status) ? 0 : 1;
    return aActive - bActive;
  });

  const applicationsWithUrls = await Promise.all(
    sortApplications.map(async (app) => ({
      ...app,
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
