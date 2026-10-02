import type { Metadata } from "next";
import Script from "next/script";
import { versionedAsset } from "@/lib/assetVersion";
import { loadLegacyPage } from "@/lib/loadLegacyPage";

const data = loadLegacyPage("home.html");

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

const LEGACY_HASH_REDIRECT = `
(function () {
  var h = (location.hash || '').replace('#', '');
  if (h === 'about') location.replace('/about/');
  else if (h === 'mahlzeit-motorsport') location.replace('/builders/mahlzeit-motorsport/');
  else if (h === 'e9-3-0cs' || h === '71e9S38B36') location.replace('/builds/71e9S38B36/');
})();
`;

export default function HomePage() {
  return (
    <>
      <Script id="legacy-hash-redirect" strategy="beforeInteractive">
        {LEGACY_HASH_REDIRECT}
      </Script>
      <div dangerouslySetInnerHTML={{ __html: data.bodyHtml }} />
      <Script src={versionedAsset("site.js")} strategy="afterInteractive" />
    </>
  );
}
