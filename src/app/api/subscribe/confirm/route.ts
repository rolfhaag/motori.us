import { NextRequest, NextResponse } from "next/server";
import { confirm, getByToken, scopeLabel } from "@/lib/follow";

/** Public: the confirmation button in the double opt-in email lands here. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const info = await getByToken(body?.token);
  if (!info) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  await confirm(info);
  return NextResponse.json({ ok: true, label: (await scopeLabel(info.scope)) ?? "motori.us" });
}
