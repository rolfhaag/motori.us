import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { SITE_URL } from "@/lib/siteUrl";
import { builderNames } from "@/lib/names";

/** RSS 2.0 feeds: new public builds for the whole site, or for one Builder. */

function x(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

interface FeedItem {
  title: string;
  link: string;
  guid: string;
  date: Date;
  description: string;
  image: string | null;
}

async function loadItems(handle?: string): Promise<{ items: FeedItem[]; builderName: string | null } | null> {
  const supabase = getSupabaseAdmin();
  let bq = supabase.from("builders").select("user_id, handle").eq("hidden", false);
  if (handle) bq = bq.eq("handle", handle);
  const { data: builders } = await bq;
  if (!builders || builders.length === 0) return handle ? null : { items: [], builderName: null };
  const ids = builders.map((b) => b.user_id);
  const { data: banned } = await supabase.from("users").select("id").in("id", ids).eq("banned", true);
  const bannedIds = new Set((banned ?? []).map((u) => u.id));
  const visible = builders.filter((b) => !bannedIds.has(b.user_id));
  if (visible.length === 0) return handle ? null : { items: [], builderName: null };

  const { data: builds } = await supabase
    .from("builds")
    .select("slug, title, theme, photos, draft_content, builder_id, created_at, updated_at, published_at")
    .in("builder_id", visible.map((b) => b.user_id))
    .eq("status", "published")
    .eq("visibility", "public")
    .eq("hidden", false)
    .not("slug", "is", null);

  const handleById = new Map(visible.map((b) => [b.user_id, b.handle as string]));
  const names = await builderNames(visible.map((b) => b.handle as string));
  const items: FeedItem[] = (builds ?? []).map((b) => {
    const photos = (b.photos ?? []) as unknown[];
    const thesis = (b.draft_content as { hero?: { thesis?: string } } | null)?.hero?.thesis || b.theme || "";
    const by = names.get(handleById.get(b.builder_id) ?? "") ?? "";
    return {
      title: b.title as string,
      link: `${SITE_URL}/builds/${b.slug}`,
      guid: `${SITE_URL}/builds/${b.slug}`,
      date: new Date((b.published_at ?? b.updated_at ?? b.created_at) as string),
      description: `${thesis ? `${thesis} ` : ""}Documented by ${by}.`.trim(),
      image: photos.length > 0 ? `${SITE_URL}/builds/${b.slug}/og` : null,
    };
  });
  items.sort((a, b) => b.date.getTime() - a.date.getTime());
  return { items: items.slice(0, 30), builderName: handle ? names.get(handle) ?? null : null };
}

export async function renderFeed(handle?: string): Promise<string | null> {
  const loaded = await loadItems(handle);
  if (!loaded) return null;
  const title = loaded.builderName ? `${loaded.builderName} on motori.us` : "motori.us: new builds";
  const selfUrl = handle ? `${SITE_URL}/builders/${handle}/feed.xml` : `${SITE_URL}/feed.xml`;
  const home = handle ? `${SITE_URL}/builders/${handle}/` : SITE_URL;
  const desc = loaded.builderName
    ? `New builds documented by ${loaded.builderName} on motori.us.`
    : "New documented builds on motori.us.";
  const updated = loaded.items[0]?.date ?? new Date();
  const body = loaded.items
    .map(
      (i) => `    <item>
      <title>${x(i.title)}</title>
      <link>${x(i.link)}</link>
      <guid isPermaLink="true">${x(i.guid)}</guid>
      <pubDate>${i.date.toUTCString()}</pubDate>
      <description>${x(i.description)}</description>${i.image ? `\n      <enclosure url="${x(i.image)}" type="image/jpeg" length="0"/>` : ""}
    </item>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${x(title)}</title>
    <link>${x(home)}</link>
    <description>${x(desc)}</description>
    <language>en-us</language>
    <lastBuildDate>${updated.toUTCString()}</lastBuildDate>
    <atom:link href="${x(selfUrl)}" rel="self" type="application/rss+xml"/>
${body}
  </channel>
</rss>
`;
}

export function feedResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
