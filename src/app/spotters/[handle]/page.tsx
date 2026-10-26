import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { displayName } from "@/lib/builderListings";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { SITE_URL } from "@/lib/siteUrl";
import { getActiveSpotterByHandle, socialLabel } from "@/lib/spotters";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const spotter = await getActiveSpotterByHandle(handle);
  if (!spotter) return { title: "motori.us" };
  const title = `${spotter.display_name}, Spotter | motori.us`;
  const description = `${spotter.display_name} finds cars worth documenting and nominates their owners to motori.us.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/spotters/${handle}/` },
    openGraph: { title, description, type: "profile", siteName: "motori.us" },
  };
}

export default async function SpotterPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const spotter = await getActiveSpotterByHandle(handle);
  if (!spotter) notFound();
  const supabase = getSupabaseAdmin();

  const { data: broughtRows } = await supabase
    .from("builders")
    .select("user_id, handle, display_name")
    .eq("brought_by_spotter_id", spotter.id)
    .eq("hidden", false);
  const ids = (broughtRows ?? []).map((b) => b.user_id);
  const { data: banned } = ids.length
    ? await supabase.from("users").select("id").in("id", ids).eq("banned", true)
    : { data: [] as { id: string }[] };
  const bannedIds = new Set((banned ?? []).map((u) => u.id));
  const brought = (broughtRows ?? []).filter((b) => !bannedIds.has(b.user_id));

  const { data: spottedBuilds } = await supabase
    .from("builds")
    .select("slug, title")
    .eq("spotted_by_spotter_id", spotter.id)
    .eq("status", "published")
    .eq("visibility", "public")
    .eq("hidden", false)
    .not("slug", "is", null)
    .order("created_at", { ascending: false });

  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero compact">
          <div className="wrap">
            <p className="eyebrow">Spotter</p>
            <h1 className="title mid">{spotter.display_name}</h1>
            <p className="thesis">
              Finds cars worth documenting and brings their owners to motori.us.
              {spotter.social_url && (
                <>
                  {" "}
                  <a href={spotter.social_url} target="_blank" rel="noopener noreferrer nofollow ugc">
                    {socialLabel(spotter.social_url)}
                  </a>
                </>
              )}
            </p>
          </div>
        </section>

        <section className="section-compact">
          <div className="wrap">
            <p className="kicker">Spotted</p>
            <h2 className="h">Builds</h2>
            {(spottedBuilds ?? []).length === 0 ? (
              <p className="lede">No builds are live yet.</p>
            ) : (
              <ul className="spotter-list">
                {(spottedBuilds ?? []).map((b) => (
                  <li key={b.slug}>
                    <a href={`/builds/${b.slug}/`}>{b.title}</a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="section-compact">
          <div className="wrap">
            <p className="kicker">Brought in</p>
            <h2 className="h">Builders</h2>
            {brought.length === 0 ? (
              <p className="lede">No Builders yet.</p>
            ) : (
              <ul className="spotter-list">
                {brought.map((b) => (
                  <li key={b.handle}>
                    <a href={`/builders/${b.handle}/`}>{(b.display_name as string | null) || displayName(b.handle)}</a>
                  </li>
                ))}
              </ul>
            )}
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
