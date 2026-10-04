import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError, verifyRequestUser } from "@/lib/verifyRequestUser";

/**
 * Same verification as verifyRequestUser, plus a role check and the
 * caller's `builders` row -- every /api/builds* route needs both the
 * verified id and the builder_id to scope rows to. Admins are always
 * allowed too (an Admin reviewing the site may also be a Builder), but
 * still need their own `builders` row to own a Build, same as anyone else.
 */
export async function requireBuilder(req: NextRequest) {
  const { privyUserId } = await verifyRequestUser(req);

  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", privyUserId)
    .maybeSingle();

  if (user?.role !== "builder" && user?.role !== "admin") {
    throw new AuthError("Builder access required.", 403);
  }

  const { data: builder } = await supabase
    .from("builders")
    .select("user_id, handle")
    .eq("user_id", privyUserId)
    .maybeSingle();

  if (!builder) {
    throw new AuthError("A Builder profile is required before submitting a Build.", 403);
  }

  return { privyUserId, builderId: builder.user_id, handle: builder.handle };
}
