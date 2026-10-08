import type { Metadata } from "next";
import Script from "next/script";
import { versionedAsset } from "@/lib/assetVersion";
import { loadLegacyPage } from "@/lib/loadLegacyPage";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { maskVin } from "@/lib/vin";
import DynamicBuildPage, { generateMetadata as dynamicMetadata } from "../[slug]/page";

const SLUG = "71e9S38B36";
const FALLBACK_YEAR = 1971; // only used if the database can't be reached

// Read per request so the heading follows the Year stored on the Build row
// (the page used to have "1971" typed into its title by hand).
export const dynamic = "force-dynamic";

async function load() {
  const raw = loadLegacyPage("build-71e9S38B36.html");
  let year = FALLBACK_YEAR;
  let vinMasked = "•••••••"; // masked on the server; the full VIN never enters this page
  try {
    const { data } = await getSupabaseAdmin().from("builds").select("year, vin").eq("slug", SLUG).maybeSingle();
    if (data?.year) year = data.year;
    if (data?.vin) vinMasked = maskVin(data.vin) ?? vinMasked;
  } catch {
    /* keep the fallbacks */
  }
  const fill = (t: string) => t.replace(/\{\{YEAR\}\}/g, String(year)).replace(/\{\{VIN_MASKED\}\}/g, vinMasked);
  return {
    year,
    data: {
      ...raw,
      title: fill(raw.title),
      description: fill(raw.description),
      bodyHtml: fill(raw.bodyHtml),
    },
  };
}

// Once the E9's content has been moved into its database row (Admin > Builds >
// "Swap into live E9"), this URL renders from the database like every other
// Build and the hand-built HTML below is no longer used.
async function isConverted(): Promise<boolean> {
  try {
    const { data } = await getSupabaseAdmin().from("builds").select("draft_content").eq("slug", SLUG).maybeSingle();
    return !!data?.draft_content;
  } catch {
    return false;
  }
}

const params = Promise.resolve({ slug: SLUG });

export async function generateMetadata(): Promise<Metadata> {
  if (await isConverted()) return dynamicMetadata({ params });
  const { data } = await load();
  return {
    title: data.title,
    description: data.description,
    alternates: { canonical: data.canonical },
    openGraph: {
      title: data.title,
      description: data.description,
      images: data.ogImage ? [data.ogImage] : undefined,
      url: data.canonical,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: data.title,
      description: data.description,
      images: data.ogImage ? [data.ogImage] : undefined,
    },
  };
}

// No VIN here on purpose: it's slated to be gated behind a future
// Buyer/Browser role, so it stays out of crawlable markup.
export default async function BuildPage() {
  if (await isConverted()) return DynamicBuildPage({ params });
  const { year, data } = await load();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name: `${year} BMW E9 S38B36`,
    manufacturer: { "@type": "Organization", name: "BMW" },
    model: "E9",
    vehicleModelDate: String(year),
    description: data.description,
    image: data.ogImage || undefined,
    url: data.canonical,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div dangerouslySetInnerHTML={{ __html: data.bodyHtml }} />
      <Script src={versionedAsset("qrcode.min.js")} strategy="afterInteractive" />
      <Script src={versionedAsset("qr.js")} strategy="afterInteractive" />
      <Script src={versionedAsset("site.js")} strategy="afterInteractive" />
    </>
  );
}
