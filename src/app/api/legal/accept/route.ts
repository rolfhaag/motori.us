import { NextRequest, NextResponse } from "next/server";
import { AuthError, verifyRequestUser } from "@/lib/verifyRequestUser";
import { parseAcceptEntries, recordAcceptances } from "@/lib/legal/server";

/** Records that the signed-in user accepted the listed (current) document versions. */
export async function POST(req: NextRequest) {
  try {
    const { privyUserId } = await verifyRequestUser(req);
    const body = await req.json().catch(() => ({}));
    const entries = parseAcceptEntries(body?.docs);
    if (entries.length === 0) return NextResponse.json({ error: "Nothing to accept." }, { status: 400 });
    const result = await recordAcceptances(req, privyUserId, entries, "gate");
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[legal] accept failed:", err);
    return NextResponse.json({ error: "Could not record your acceptance." }, { status: 500 });
  }
}
