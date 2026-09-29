import type { Metadata } from "next";
import Script from "next/script";
import { loadLegacyPage } from "@/lib/loadLegacyPage";

const data = loadLegacyPage("builder-mahlzeit-motorsport.html");

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

export default function BuilderPage() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: data.bodyHtml }} />
      <Script src="/assets/qrcode.min.js" strategy="afterInteractive" />
      <Script src="/assets/qr.js" strategy="afterInteractive" />
      <Script src="/assets/site.js" strategy="afterInteractive" />
      <Script src="https://www.instagram.com/embed.js" strategy="lazyOnload" />
      <Script src="https://www.tiktok.com/embed.js" strategy="lazyOnload" />
    </>
  );
}
