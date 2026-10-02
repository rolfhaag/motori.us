import type { Metadata } from "next";
import Script from "next/script";
import { versionedAsset } from "@/lib/assetVersion";
import { loadLegacyPage } from "@/lib/loadLegacyPage";

const data = loadLegacyPage("about.html");

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

export default function AboutPage() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: data.bodyHtml }} />
      <Script src={versionedAsset("site.js")} strategy="afterInteractive" />
    </>
  );
}
