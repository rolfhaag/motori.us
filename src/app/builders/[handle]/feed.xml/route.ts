import { feedResponse, renderFeed } from "@/lib/feeds";

export const dynamic = "force-dynamic";

/** RSS feed of one Builder's new public builds. */
export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  let xml: string | null = null;
  try {
    xml = await renderFeed(handle);
  } catch (err) {
    console.error("[feed] failed:", err);
    return new Response("Feed unavailable", { status: 503 });
  }
  return xml ? feedResponse(xml) : new Response("Not found", { status: 404 });
}
