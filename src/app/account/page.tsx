"use client";

import { usePrivy } from "@privy-io/react-auth";
import SiteHeader from "@/components/SiteHeader";
import FollowingList from "@/components/FollowingList";

export default function AccountPage() {
  const { ready, authenticated, login } = usePrivy();
  if (!ready) return null;
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero compact">
          <div className="wrap">
            <p className="eyebrow">Your account</p>
            <h1 className="title mid">Following</h1>
          </div>
        </section>
        <section>
          <div className="wrap">
            {authenticated ? (
              <>
                <FollowingList />
                <p className="follow-sub" style={{ marginTop: 28 }}>
                  Own a build worth documenting? <a href="/apply/">Apply to be a Builder</a>.
                </p>
              </>
            ) : (
              <div className="formcard">
                <p className="lede">Log in to see the builds and Builders you follow.</p>
                <button className="btn-primary" type="button" onClick={login}>
                  Log in
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
