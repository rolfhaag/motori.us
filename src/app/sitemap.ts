import type { MetadataRoute } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { SITE_URL } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/` },
    { url: `${SITE_URL}/about/` },
    { url: `${SITE_URL}/builders/mahlzeit-motorsport/` },
    { url: `${SITE_URL}/builds/71e9S38B36/` },
  ];

  try {
    const { data } = await getSupabaseAdmin()
      .from("builds")
      .select("slug, updated_at")
      .eq("status", "published")
      .eq("visibility", "public")
      .eq("hidden", false)
      .not("slug", "is", null);
    const seen = new Set(entries.map((e) => e.url));
    for (const b of data ?? []) {
      if (seen.has(`${SITE_URL}/builds/${b.slug}/`)) continue; // static pages already listed
      entries.push({ url: `${SITE_URL}/builds/${b.slug}/`, lastModified: b.updated_at });
    }
  } catch {
    // DB unreachable: still serve the static entries.
  }
  return entries;
}
