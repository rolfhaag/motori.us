import { NextRequest, NextResponse } from "next/server";
import { getByToken, resubscribe, unsubscribe } from "@/lib/follow";

/**
 * Unsubscribe. Accepts:
 * - the mail clients' one-click POST (RFC 8058): token in the query string and a
 *   form body "List-Unsubscribe=One-Click";
 * - our own page: JSON {token, all?: boolean, undo?: boolean}.
 */
export async function POST(req: NextRequest) {
  const queryToken = req.nextUrl.searchParams.get("token");
  const type = req.headers.get("content-type") || "";
  let token: unknown = queryToken;
  let all = false;
  let undo = false;
  if (type.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    token = body?.token ?? queryToken;
    all = body?.all === true;
    undo = body?.undo === true;
  }
  const info = await getByToken(token);
  if (!info) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  if (undo) await resubscribe(info);
  else await unsubscribe(info, all);
  return NextResponse.json({ ok: true });
}
