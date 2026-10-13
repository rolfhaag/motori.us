import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { BuildPhoto } from "@/lib/buildAssets";

/**
 * Public listings for the home page and Builder pages: every non-hidden,
 * non-banned Builder with their published, public, non-hidden Builds.
 * (Privately published builds never appear in listings.)
 */

export const E9_SLUG = "71e9S38B36";

export interface ListedBuild {
  slug: string;
  no: number; // 1-based, oldest first
  title: string;
  blurb: string;
  imageSrc: string | null;
}

export interface ListedBuilder {
  handle: string;
  name: string;
  tagline: string;
  builds: ListedBuild[];
}

// The original hand-written profile copy for the first Builder.
const BUILDER_OVERRIDES: Record<string, { name: string; tagline: string }> = {
  "mahlzeit-motorsport": {
    name: "Mahlzeit Motorsport",
    tagline: "California. Restomods and specialty builds, documented from the first inspection.",
  },
};

export function displayName(handle: string): string {
  return (
    BUILDER_OVERRIDES[handle]?.name ??
    handle
      .split("-")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

interface BuildRow {
  slug: string;
  title: string;
  theme: string | null;
  photos: BuildPhoto[] | null;
  draft_content: { hero?: { thesis?: string } } | null;
  builder_id: string;
  created_at: string;
}

function toListedBuild(b: BuildRow, no: number): ListedBuild {
  const isE9 = b.slug === E9_SLUG;
  const photos = (b.photos ?? []) as BuildPhoto[];
  const blurbSource = isE9
    ? "S38B36 six and Getrag G280 out of an E34 M5. In progress."
    : b.draft_content?.hero?.thesis || b.theme || "";
  return {
    slug: b.slug,
    no,
    title: b.title,
    blurb: clip(blurbSource, 140),
    // The original E9 page is a hand-built static page with its own image.
    imageSrc: isE9 ? "/images/e9-front.jpg" : photos.length > 0 ? `/builds/${b.slug}/og` : null,
  };
}

async function loadBuilders(handle?: string): Promise<ListedBuilder[]> {
  const supabase = getSupabaseAdmin();

  let builderQuery = supabase.from("builders").select("user_id, handle, description").eq("hidden", false);
  if (handle) builderQuery = builderQuery.eq("handle", handle);
  const { data: builders } = await builderQuery;
  if (!builders || builders.length === 0) return [];

  const ids = builders.map((b) => b.user_id);
  const { data: banned } = await supabase.from("users").select("id").in("id", ids).eq("banned", true);
  const bannedIds = new Set((banned ?? []).map((u) => u.id));
  const visible = builders.filter((b) => !bannedIds.has(b.user_id));
  if (visible.length === 0) return [];

  const { data: builds } = await supabase
    .from("builds")
    .select("slug, title, theme, photos, draft_content, builder_id, created_at")
    .in(
      "builder_id",
      visible.map((b) => b.user_id)
    )
    .eq("status", "published")
    .eq("visibility", "public")
    .eq("hidden", false)
    .not("slug", "is", null)
    .order("created_at", { ascending: true });

  return visible.map((b) => {
    const mine = ((builds ?? []) as BuildRow[]).filter((x) => x.builder_id === b.user_id);
    const override = BUILDER_OVERRIDES[b.handle];
    return {
      handle: b.handle,
      name: displayName(b.handle),
      tagline: override?.tagline ?? clip(b.description ?? "", 160),
      builds: mine.map((x, i) => toListedBuild(x, i + 1)),
    };
  });
}

/** Home page: Builders that have at least one public build, oldest Builder first. */
export async function getHomeListings(): Promise<ListedBuilder[]> {
  const all = await loadBuilders();
  return all.filter((b) => b.builds.length > 0);
}

export async function getBuilderListing(handle: string): Promise<ListedBuilder | null> {
  const [b] = await loadBuilders(handle);
  return b ?? null;
}

/** Every visible Builder handle (for the sitemap). */
export async function getAllBuilderHandles(): Promise<string[]> {
  return (await loadBuilders()).map((b) => b.handle);
}
