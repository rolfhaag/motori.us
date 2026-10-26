import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SpotterJoin from "@/components/SpotterJoin";
import { SITE_URL } from "@/lib/siteUrl";

// The preview card people see when the link is sent in a DM or text.
const TITLE = "You're invited to be a Spotter on motori.us";
const DESCRIPTION = "Find cars worth documenting, send their owners a personal link, and get credited when they're featured.";

export const metadata: Metadata = {
  title: `${TITLE}`,
  description: DESCRIPTION,
  robots: { index: false, follow: false },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    siteName: "motori.us",
    images: [{ url: `${SITE_URL}/images/e9-front.jpg`, width: 1600, height: 1067 }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [`${SITE_URL}/images/e9-front.jpg`] },
};

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero compact">
          <div className="wrap">
            <p className="eyebrow">Spotter</p>
            <h1 className="title mid">Become a Spotter</h1>
            <p className="thesis">
              Find cars worth documenting, send their owners a personal link, and get credited when they&rsquo;re featured.
            </p>
          </div>
        </section>
        <section>
          <div className="wrap">
            <SpotterJoin />
          </div>
        </section>
      </main>
    </>
  );
}
