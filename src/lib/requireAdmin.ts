import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError, verifyRequestUser } from "@/lib/verifyRequestUser";

/**
 * Same verification as verifyRequestUser, plus a role check. Every
 * /api/admin/* route calls this first -- a 403 here means "not an admin",
 * not "not logged in".
 */
export async function requireAdmin(req: NextRequest) {
  const { privyUserId } = await verifyRequestUser(req);

  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("users").select("role").eq("id", privyUserId).maybeSingle();

  if (data?.role !== "admin") {
    throw new AuthError("Admin access required.", 403);
  }

  return { privyUserId };
}
