import { NextRequest, NextResponse } from "next/server";
import { getByToken, maskEmail, scopeLabel } from "@/lib/follow";

/** Public, token-gated: what a confirm/unsubscribe link refers to (email is masked). */
export async function GET(req: NextRequest) {
  const info = await getByToken(req.nextUrl.searchParams.get("token"));
  if (!info) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  return NextResponse.json({
    email: maskEmail(info.email),
    status: info.status,
    label: (await scopeLabel(info.scope)) ?? (info.scope === "site" ? "new builds on motori.us" : "this page"),
    scopeKind: info.scope === "site" ? "site" : info.scope.split(":")[0],
  });
}
