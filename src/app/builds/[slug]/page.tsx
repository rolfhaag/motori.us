import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { BuildPhoto, signBuildPhotoUrls } from "@/lib/buildAssets";
import { versionedAsset } from "@/lib/assetVersion";

export const dynamic = "force-dynamic";

interface BuildRow {
  id: string;
  slug: string;
  title: string;
  make: string | null;
  model: string | null;
  trim: string | null;
  vin: string | null;
  theme: string | null;
  photos: BuildPhoto[];
  draft_content: unknown;
  builder_id: string;
}

async function getBuild(slug: string): Promise<BuildRow | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("builds")
    .select("id, slug, title, make, model, trim, vin, theme, photos, draft_content, builder_id")
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

  const title = `${build.title} — motori.us`;
  const description =
    build.theme ?? `Documented build of a ${build.title}, logged as it progresses on motori.us.`;
  const canonical = `https://www.motori.us/builds/${build.slug}/`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website" },
    twitter: { card: "summary_large_image", title, description },
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

  const handle = await getBuilderHandle(build.builder_id);
  const photoUrls = await signBuildPhotoUrls(build.photos ?? []);
  const [heroPhoto, ...restPhotos] = photoUrls;

  const chips = [build.make, build.model, build.trim].filter(Boolean) as string[];

  return (
    <>
      <header className="site">
        <div className="navbar">
          <div className="navleft">
            <a className="brand" href="/">
              motori<em>.</em>us
            </a>
            {handle && (
              <nav className="crumbs">
                <span className="sep">/</span>
                <a href={`/builders/${handle}/`}>{handle}</a>
                <span className="sep">/</span>
                <span className="here">{build.title}</span>
              </nav>
            )}
          </div>
          <nav className="navright">
            <a href="/about/">About</a>
            <a className="nav-cta" href="/apply/">
              Be a Builder
            </a>
            <span id="auth-slot"></span>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero compact">
          <div className="wrap">
            <p className="eyebrow">{handle ?? "motori.us"}</p>
            <h1 className="title mid">{build.title}</h1>
            {build.theme && <p className="thesis">{build.theme}</p>}
            {build.vin && (
              <p className="vin">
                <span className="vin-label">VIN</span>
                <span className="vin-value">{build.vin}</span>
              </p>
            )}
            {chips.length > 0 && (
              <div className="heroSpecs">
                {chips.map((c) => (
                  <span className="chip" key={c}>
                    {c}
                  </span>
                ))}
              </div>
            )}
            <button
              className="share-link"
              type="button"
              data-share-url={`https://www.motori.us/builds/${build.slug}/`}
              data-share-name={build.title}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="M8.6 10.5l6.8-3.8M8.6 13.5l6.8 3.8" />
              </svg>
              <span className="share-link-label">Share</span>
            </button>
          </div>
          {heroPhoto && (
            <div className="hero-photo">
              <img src={heroPhoto} alt={build.title} />
            </div>
          )}
        </section>

        {restPhotos.length > 0 && (
          <section id="gallery">
            <div className="wrap">
              <p className="kicker">Gallery</p>
              <h2 className="h">Photos</h2>
              <div className="gallery">
                {restPhotos.map((url) => (
                  <div className="photo" key={url}>
                    <img src={url} alt={build.title} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section>
          <div className="wrap">
            <p className="kicker">Documentation</p>
            <h2 className="h">More to come</h2>
            <p className="lede">
              This build&rsquo;s full write-up -- baseline condition, roadmap, and a working log of
              updates -- is being prepared. Check back soon.
            </p>
          </div>
        </section>

        {handle && (
          <div className="wrap backlink">
            <a className="cta-link" href={`/builders/${handle}/`}>
              &larr; Back to {handle}
            </a>
          </div>
        )}
      </main>

      <footer>
        <div className="wrap">
          <span>motori.us: one open record for every build.</span>
        </div>
      </footer>

      <Script src={versionedAsset("qrcode.min.js")} strategy="afterInteractive" />
      <Script src={versionedAsset("qr.js")} strategy="afterInteractive" />
      <Script src={versionedAsset("site.js")} strategy="afterInteractive" />
    </>
  );
}
