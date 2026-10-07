import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Script from "next/script";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { BuildPhoto, signBuildPhotoUrls } from "@/lib/buildAssets";
import { versionedAsset } from "@/lib/assetVersion";
import { SITE_URL } from "@/lib/siteUrl";
import BuildPageView from "@/components/BuildPageView";
import type { DraftContent } from "@/lib/buildDraft";
import { maskVin } from "@/lib/vin";
import PrivateBuildGate from "@/components/PrivateBuildGate";
import { accessCookieName, hasAccess } from "@/lib/buildAccess";

export const dynamic = "force-dynamic";

interface BuildRow {
  id: string;
  slug: string;
  title: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  vin: string | null;
  theme: string | null;
  photos: BuildPhoto[];
  draft_content: unknown;
  builder_id: string;
  visibility: string;
  access_password_hash: string | null;
}

async function getBuild(slug: string): Promise<BuildRow | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("builds")
    .select("id, slug, title, year, make, model, trim, vin, theme, photos, draft_content, builder_id, visibility, access_password_hash")
    .eq("slug", slug)
    .eq("status", "published")
    .eq("hidden", false)
    .maybeSingle();
  return data as BuildRow | null;
}

async function getBuilderHandle(builderId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("builders").select("handle").eq("user_id", builderId).maybeSingle();
  return data?.handle ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const build = await getBuild(slug);
  if (!build) return { title: "motori.us" };

  // Private builds: no description, no image, no indexing -- the page itself
  // is behind a password, so the link preview shouldn't leak anything.
  if (build.visibility === "private") {
    return {
      title: "Private build — motori.us",
      robots: { index: false, follow: false },
    };
  }

  const title = `${build.title} — motori.us`;
  const description =
    (build.draft_content as DraftContent | null)?.hero?.thesis ||
    build.theme ||
    `Documented build of a ${build.title}, logged as it progresses on motori.us.`;
  const canonical = `${SITE_URL}/builds/${build.slug}/`;
  const hasPhoto = (build.photos ?? []).length > 0;
  const images = hasPhoto ? [`${SITE_URL}/builds/${build.slug}/og`] : undefined;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website", images },
    twitter: { card: hasPhoto ? "summary_large_image" : "summary", title, description, images },
  };
}

/**
 * Dynamic Build page (Chunk 3), rendered from Supabase. Coexists with any
 * static /builds/<slug>/ route (Next.js resolves the literal segment first),
 * so the existing E9 page is untouched. When `draft_content` is null -- the
 * AI drafting step (Chunk 2) hasn't produced a page yet -- this falls back
 * to a plain render of the Builder's own typed fields and photos, rather
 * than waiting on Chunk 2 to ship anything at all.
 */
export default async function DynamicBuildPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const build = await getBuild(slug);
  if (!build) notFound();

  if (build.visibility === "private") {
    const jar = await cookies();
    if (!hasAccess(build.slug, build.access_password_hash, jar.get(accessCookieName(build.slug))?.value)) {
      return <PrivateBuildGate slug={build.slug} />;
    }
  }

  const handle = await getBuilderHandle(build.builder_id);
  const photoEntries = (build.photos ?? []) as BuildPhoto[];
  const photoUrls = await signBuildPhotoUrls(photoEntries);
  const photos = photoUrls.map((url, i) => ({
    url,
    caption: photoEntries[i]?.caption,
    category: photoEntries[i]?.category,
  }));

  // VIN is deliberately left out: it's slated to be gated behind a future
  // Buyer/Browser role, so it must not leak into crawlable markup.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name: build.title,
    ...(build.year ? { vehicleModelDate: String(build.year) } : {}),
    ...(build.make ? { manufacturer: { "@type": "Organization", name: build.make } } : {}),
    ...(build.model ? { model: build.model } : {}),
    ...(build.trim ? { vehicleConfiguration: build.trim } : {}),
    ...(build.theme ? { description: build.theme } : {}),
    ...(photos.length ? { image: `${SITE_URL}/builds/${build.slug}/og` } : {}),
    url: `${SITE_URL}/builds/${build.slug}/`,
  };

  return (
    <>
      {build.visibility !== "private" && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}
      <BuildPageView
        build={{ ...build, vinMasked: maskVin(build.vin) }}
        draft={(build.draft_content as DraftContent | null) ?? null}
        photos={photos}
        handle={handle}
      />
      <Script src={versionedAsset("qrcode.min.js")} strategy="afterInteractive" />
      <Script src={versionedAsset("qr.js")} strategy="afterInteractive" />
      <Script src={versionedAsset("site.js")} strategy="afterInteractive" />
    </>
  );
}
