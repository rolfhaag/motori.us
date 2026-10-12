import { NextRequest, NextResponse } from "next/server";
import { sendDueNudges } from "@/lib/email/notify";

export const dynamic = "force-dynamic";

/**
 * Daily job (see vercel.json): sends the one gentle nudge for drafts that
 * have sat unfinished for a week. Vercel calls it with
 * `Authorization: Bearer $CRON_SECRET`; anything else is refused.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const sent = await sendDueNudges();
  return NextResponse.json({ ok: true, sent });
}
