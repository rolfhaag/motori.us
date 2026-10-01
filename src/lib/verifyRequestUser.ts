import { NextRequest } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Shared by every API route that needs to know who's calling: verifies the
 * Privy access token server-side (same check as /api/auth/sync) and returns
 * the verified Privy user id + email. Never trust a client-supplied id.
 */
export async function verifyRequestUser(req: NextRequest) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const privyAppSecret = process.env.PRIVY_APP_SECRET;
  if (!privyAppId || !privyAppSecret) {
    throw new AuthError("Privy is not configured on the server yet.", 500);
  }

  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    throw new AuthError("Missing access token.", 401);
  }

  const privy = new PrivyClient(privyAppId, privyAppSecret);

  let verifiedClaims;
  try {
    verifiedClaims = await privy.verifyAuthToken(accessToken);
  } catch {
    throw new AuthError("Invalid or expired token.", 401);
  }

  const privyUserId = verifiedClaims.userId;

  let user;
  try {
    user = await privy.getUser(privyUserId);
  } catch {
    throw new AuthError("Could not load user from Privy.", 502);
  }

  const email = user.email?.address?.toLowerCase().trim() ?? null;

  // A banned user's Privy session may still be valid, but they're locked out
  // of the app itself -- checked here so every route gets this for free.
  const supabase = getSupabaseAdmin();
  const { data: dbUser } = await supabase
    .from("users")
    .select("banned")
    .eq("id", privyUserId)
    .maybeSingle();
  if (dbUser?.banned) {
    throw new AuthError("This account has been suspended.", 403);
  }

  return { privyUserId, email };
}
