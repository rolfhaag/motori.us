import type { Metadata } from "next";
import Script from "next/script";
import { versionedAsset } from "@/lib/assetVersion";
import { loadLegacyPage } from "@/lib/loadLegacyPage";

const data = loadLegacyPage("build-71e9S38B36.html");

export const metadata: Metadata = {
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

// No VIN here on purpose: it's slated to be gated behind a future
// Buyer/Browser role, so it stays out of crawlable markup.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Vehicle",
  name: "1971 BMW E9 S38B36",
  manufacturer: { "@type": "Organization", name: "BMW" },
  model: "E9",
  vehicleModelDate: "1971",
  description: data.description,
  image: data.ogImage || undefined,
  url: data.canonical,
};

export default function BuildPage() {
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
