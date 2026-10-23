import { feedResponse, renderFeed } from "@/lib/feeds";

export const dynamic = "force-dynamic";

/** RSS feed of new public builds across motori.us. */
export async function GET() {
  let xml: string | null = null;
  try {
    xml = await renderFeed();
  } catch (err) {
    console.error("[feed] failed:", err);
    return new Response("Feed unavailable", { status: 503 });
  }
  return xml ? feedResponse(xml) : new Response("Feed unavailable", { status: 503 });
}
