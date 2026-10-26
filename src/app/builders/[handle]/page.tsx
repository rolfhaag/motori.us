import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import { versionedAsset } from "@/lib/assetVersion";
import { loadLegacyPage } from "@/lib/loadLegacyPage";
import { getBuilderListing, displayName } from "@/lib/builderListings";
import { builderBuildsHtml } from "@/lib/builderMarkup";
import { esc } from "@/lib/email/layout";
import { followAlongHtml, parseSocials } from "@/lib/socials";
import { SITE_URL } from "@/lib/siteUrl";
import { FollowButtonPortal } from "@/components/FollowButton";

// Builders and builds come from the database, so render per request.
export const dynamic = "force-dynamic";

const FIRST_BUILDER = "mahlzeit-motorsport";
// The first Builder keeps its hand-written blurb and social embeds.
const legacy = loadLegacyPage("builder-mahlzeit-motorsport.html");
const FOLLOW_SECTION = /<section id="builder-follow"[\s\S]*?<\/section>/.exec(legacy.bodyHtml)?.[0] ?? "";
const FIRST_BLURB = legacy.description;

function blurbFor(handle: string, tagline: string): string {
  return handle === FIRST_BUILDER ? FIRST_BLURB : tagline;
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const builder = await getBuilderListing(handle);
  if (!builder) return { title: "motori.us" };
  const title = `${builder.name} — motori.us`;
  const description = blurbFor(handle, builder.tagline) || `Builds by ${builder.name} on motori.us.`;
  const first = builder.builds[0];
  const image = first?.imageSrc ? `${SITE_URL}${first.imageSrc}` : undefined;
  const url = `${SITE_URL}/builders/${handle}/`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, images: image ? [image] : undefined, url, type: "website" },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  };
}

export default async function BuilderPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const builder = await getBuilderListing(handle);
  if (!builder) notFound();

  const isFirst = handle === FIRST_BUILDER;
  const blurb = blurbFor(handle, builder.tagline);
  const count = builder.builds.length;
  const along = isFirst ? null : followAlongHtml(parseSocials(builder.socials));
  const lede =
    count === 0
      ? `${builder.name} hasn’t published a build yet.`
      : `Every car ${builder.name} takes on gets its own open record.`;

  const html = `
<div class="stripe"></div>
<header class="site">
  <div class="navbar">
    <div class="navleft">
      <a class="brand" href="/">motori<em>.</em>us</a>
      <nav class="crumbs"><span class="sep">/</span><span class="here">${esc(builder.name)}</span></nav>
    </div>
    <nav class="navright">
      <a href="/about/">About</a>
      <a class="nav-cta" href="/apply/">Be a Builder</a><span id="auth-slot"></span>
    </nav>
  </div>
</header>
<main>
  <section class="hero compact">
    <div class="wrap builderhead">
      <p class="eyebrow">Builder profile</p>
      <h1 class="title mid">${esc(builder.name)}</h1>
      ${blurb ? `<p class="blurb">${esc(blurb)}</p>` : ""}
      ${builder.broughtBy ? `<p class="spotted-by">Brought to motori.us by <a href="/spotters/${esc(builder.broughtBy.handle)}/">${esc(builder.broughtBy.name)}</a></p>` : ""}
      <div class="builder-actions share-row">
      <button class="share-link" type="button" data-share-url="${SITE_URL}/builders/${esc(handle)}/" data-share-name="${esc(builder.name)}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.5l6.8-3.8M8.6 13.5l6.8 3.8"/></svg>
        <span class="share-link-label">Share</span>
      </button>
      <span id="follow-btn-slot" class="follow-slot"></span>
      </div>
    </div>
  </section>
  <section id="builder-builds" class="section-compact">
    <div class="wrap">
      <p class="kicker">The roster</p>
      <h2 class="h">Builds</h2>
      <p class="lede">${esc(lede)}</p>
      ${builderBuildsHtml(builder)}
    </div>
  </section>
  ${isFirst ? FOLLOW_SECTION : along?.html ?? ""}
</main>
<footer>
  <div class="wrap">
    <span>motori.us: one open record for every build.</span>
  </div>
</footer>`;

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <Script src={versionedAsset("qrcode.min.js")} strategy="afterInteractive" />
      <Script src={versionedAsset("qr.js")} strategy="afterInteractive" />
      <Script src={versionedAsset("site.js")} strategy="afterInteractive" />
      <FollowButtonPortal targetId="follow-btn-slot" scope={`builder:${handle}`} name={builder.name} />
      {(isFirst || along?.hasInstagram) && <Script src="https://www.instagram.com/embed.js" strategy="lazyOnload" />}
      {(isFirst || along?.hasTikTok) && <Script src="https://www.tiktok.com/embed.js" strategy="lazyOnload" />}
    </>
  );
}
