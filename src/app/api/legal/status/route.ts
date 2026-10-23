import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError, verifyRequestUser } from "@/lib/verifyRequestUser";
import { ensureLegalDocs, missingAcceptances, requiredDocTypes } from "@/lib/legal/server";

/** What the signed-in user still has to accept (drives the terms prompt). */
export async function GET(req: NextRequest) {
  try {
    const { privyUserId } = await verifyRequestUser(req);
    const { data: user } = await getSupabaseAdmin().from("users").select("role").eq("id", privyUserId).maybeSingle();
    const types = requiredDocTypes(user?.role);
    const [missing, docs] = await Promise.all([missingAcceptances(privyUserId, types), ensureLegalDocs()]);
    return NextResponse.json({
      role: user?.role ?? "applicant",
      pending: missing.map((d) => ({
        type: d.type,
        title: d.title,
        version: d.version,
        path: d.path,
        effectiveDate: d.effectiveDate,
        changeSummary: d.changeSummary,
      })),
      builderTerms: {
        title: docs.builder_terms.title,
        version: docs.builder_terms.version,
        path: docs.builder_terms.path,
        accepted: !(await missingAcceptances(privyUserId, ["builder_terms"])).length,
      },
      current: types.map((t) => ({ type: t, title: docs[t].title, version: docs[t].version, path: docs[t].path })),
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[legal] status failed:", err);
    return NextResponse.json({ error: "Could not load terms status." }, { status: 500 });
  }
}
