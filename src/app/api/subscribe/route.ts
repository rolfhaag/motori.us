import { NextRequest, NextResponse } from "next/server";
import { subscribe } from "@/lib/follow";

/** Public: ask to follow the site, a Builder or a Build. Sends a confirmation email. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  // Honeypot: real people never fill this hidden field.
  if (typeof body?.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true, state: "confirmation_sent" });
  }
  const source = typeof body?.source === "string" ? body.source.slice(0, 200) : null;
  const result = await subscribe(req, body?.email, body?.scope, source);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, state: result.state });
}
