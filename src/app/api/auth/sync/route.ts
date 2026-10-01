import { NextRequest, NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Called by the client right after a successful Privy login. Verifies the
 * Privy access token server-side (never trust a client-supplied user id
 * directly), then upserts a row in Supabase for that user — creating it on
 * first login, assigning the seeded Admin role if the verified email
 * matches ADMIN_SEED_EMAIL, and otherwise defaulting to 'applicant'.
 *
 * There is no client-facing way to set role=admin; this route is the only
 * path that ever assigns it, and only for the one seeded email.
 */
export async function POST(req: NextRequest) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const privyAppSecret = process.env.PRIVY_APP_SECRET;
  const adminSeedEmail = process.env.ADMIN_SEED_EMAIL?.toLowerCase().trim();

  if (!privyAppId || !privyAppSecret) {
    return NextResponse.json(
      { error: "Privy is not configured on the server yet." },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 });
  }

  const privy = new PrivyClient(privyAppId, privyAppSecret);

  let verifiedClaims;
  try {
    verifiedClaims = await privy.verifyAuthToken(accessToken);
  } catch {
    return NextResponse.json({ error: "Invalid or expired token." }, { status: 401 });
  }

  const privyUserId = verifiedClaims.userId; // e.g. "did:privy:abc123"

  let user;
  try {
    user = await privy.getUser(privyUserId);
  } catch {
    return NextResponse.json({ error: "Could not load user from Privy." }, { status: 502 });
  }

  const email = user.email?.address?.toLowerCase().trim() ?? null;
  const evmWallet =
    user.wallet?.chainType === "ethereum" ? user.wallet : undefined;

  const role = email && adminSeedEmail && email === adminSeedEmail ? "admin" : "applicant";

  const supabase = getSupabaseAdmin();

  // Preserve an existing row's role rather than overwriting it on every
  // login (e.g. don't demote an Admin back to 'applicant' just because the
  // seed-check logic runs again, and don't downgrade a promoted Builder).
  const { data: existing } = await supabase
    .from("users")
    .select("role")
    .eq("id", privyUserId)
    .maybeSingle();

  const { error } = await supabase.from("users").upsert({
    id: privyUserId,
    email,
    role: existing?.role ?? role,
    wallet_address_evm: evmWallet?.address ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, role: existing?.role ?? role });
}
