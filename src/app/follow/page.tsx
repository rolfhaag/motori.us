import type { Metadata } from "next";
import FollowBox from "@/components/FollowBox";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Follow new builds | motori.us",
  description: "Get an email when a new build is published on motori.us, or follow along by RSS.",
  alternates: { canonical: "https://www.motori.us/follow" },
};

export default function FollowPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero compact">
          <div className="wrap">
            <p className="eyebrow">Follow</p>
            <h1 className="title mid">Follow new builds</h1>
            <p className="thesis">
              A short email when a new documented build goes live, and the occasional note from the team. No account
              needed.
            </p>
          </div>
        </section>
        <section className="follow-section">
          <div className="wrap">
            <FollowBox
              scope="site"
              heading="New builds on motori.us"
              sub="One email per new build. Confirm once, unsubscribe any time."
              source="/follow"
            />
            <p className="follow-sub" style={{ marginTop: 22, maxWidth: 620 }}>
              Prefer a feed reader? Subscribe to the{" "}
              <a href="/feed.xml" style={{ color: "var(--accent)" }}>
                motori.us RSS feed
              </a>
              . Every Builder page has its own feed too. You can also follow a single Builder or Build from its page.
            </p>
          </div>
        </section>
      </main>
      <footer>
        <div className="wrap">
          <span>motori.us: one open record for every build.</span>
        </div>
      </footer>
    </>
  );
}
