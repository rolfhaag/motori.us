import type { DraftContent } from "@/lib/buildDraft";
import { SITE_URL } from "@/lib/siteUrl";

export interface ViewPhoto {
  url: string;
  caption?: string;
  category?: string;
}

export interface ViewBuild {
  slug: string;
  title: string;
  year?: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  vin: string | null;
  theme: string | null;
}

const TABS = ["exterior", "interior", "mechanical"];

/**
 * The fixed Build-page template, rendered from a Build row. With a
 * `draft` (AI-drafted content) it renders the full E9-style page; without
 * one it falls back to the Builder's typed fields and photos. Pure markup
 * (no hooks) so the same component can serve previews later.
 */
export default function BuildPageView({
  build,
  draft,
  photos,
  handle,
}: {
  build: ViewBuild;
  draft: DraftContent | null;
  photos: ViewPhoto[];
  handle: string | null;
}) {
  const [hero, ...rest] = photos;
  const chips = draft?.hero.specChips.length
    ? draft.hero.specChips
    : ([build.year, build.make, build.model, build.trim].filter(Boolean) as string[]);
  const shareUrl = `${SITE_URL}/builds/${build.slug}/`;
  const thesis = draft?.hero.thesis || build.theme;
  const usedTabs = TABS.filter((t) => photos.some((p) => p.category === t));

  return (
    <>
      <div className="stripe"></div>
      <header className="site">
        <div className="navbar">
          <div className="navleft">
            <a className="brand" href="/">
              motori<em>.</em>us
            </a>
            {handle && (
              <nav className="crumbs">
                <span className="sep">/</span>
                <a href={`/builders/${handle}/`}>{handle}</a>
                <span className="sep">/</span>
                <span className="here">{build.title}</span>
              </nav>
            )}
          </div>
          <nav className="navright">
            <a href="/about/">About</a>
            <a className="nav-cta" href="/apply/">
              Be a Builder
            </a>
            <span id="auth-slot"></span>
          </nav>
        </div>
        {draft && (
          <nav className="subnav">
            {rest.length > 0 && <button data-scrollto="gallery">Gallery</button>}
            <button data-scrollto="baseline">Baseline</button>
            {draft.roadmap.length > 0 && <button data-scrollto="roadmap">What&rsquo;s Next</button>}
            {draft.updates.length > 0 && <button data-scrollto="updates">Updates</button>}
          </nav>
        )}
      </header>

      <main>
        <section className="hero compact">
          <div className="wrap">
            <p className="eyebrow">{handle || draft?.hero.eyebrow || "motori.us"}</p>
            <h1 className="title mid">{build.title}</h1>
            {thesis && <p className="thesis">{thesis}</p>}
            {build.vin && (
              <p className="vin">
                <span className="vin-label">VIN</span>
                <span className="vin-value">{build.vin}</span>
              </p>
            )}
            {chips.length > 0 && (
              <div className="heroSpecs">
                {chips.map((c) => (
                  <span className="chip" key={c}>
                    {c}
                  </span>
                ))}
              </div>
            )}
            <button className="share-link" type="button" data-share-url={shareUrl} data-share-name={build.title}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="M8.6 10.5l6.8-3.8M8.6 13.5l6.8 3.8" />
              </svg>
              <span className="share-link-label">Share</span>
            </button>
          </div>
          {hero && (
            <div className="hero-photo">
              <img src={hero.url} alt={hero.caption || build.title} />
            </div>
          )}
        </section>

        {photos.length > 0 && (
          <section id="gallery">
            <div className="wrap">
              <p className="kicker">Gallery</p>
              <h2 className="h">Photos</h2>
              <p className="lede">Click any photo to see it larger.</p>
              {usedTabs.length > 1 && (
                <div className="gallery-tabs" role="tablist">
                  <button className="gtab active" type="button" data-cat="all">
                    All
                  </button>
                  {usedTabs.map((t) => (
                    <button className="gtab" type="button" data-cat={t} key={t}>
                      {t[0].toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              )}
              <div className="gallery" id="gallery-grid">
                {photos.map((p, i) => (
                  <button className="photo" type="button" data-index={i} data-cat={p.category || "exterior"} key={p.url}>
                    <img src={p.url} alt={p.caption || build.title} />
                    {p.caption && <p className="cap">{p.caption}</p>}
                  </button>
                ))}
              </div>
              <p className="gallery-more" id="gallery-more" hidden>
                <button className="cta-link" id="gallery-more-btn" type="button">
                  Show more photos &rarr;
                </button>
              </p>
            </div>
          </section>
        )}

        {draft ? (
          <>
            <section id="baseline">
              <div className="wrap">
                <p className="kicker">Baseline</p>
                <h2 className="h">The car, as it actually is</h2>
                {draft.baseline.summary && <p className="lede">{draft.baseline.summary}</p>}

                {draft.inspection && (
                  <>
                    {draft.inspection.source && (
                      <div className="prov">
                        <p>{draft.inspection.source}</p>
                      </div>
                    )}
                    <h3 className="baseline-h3">Inspection score</h3>
                    <div
                      className="score"
                      aria-label={`${draft.inspection.green + draft.inspection.yellow + draft.inspection.red} inspection items: ${draft.inspection.green} green, ${draft.inspection.yellow} yellow, ${draft.inspection.red} red`}
                    >
                      <div className="bar">
                        <span className="g" style={{ flex: draft.inspection.green }}></span>
                        <span className="y" style={{ flex: draft.inspection.yellow }}></span>
                        <span className="r" style={{ flex: draft.inspection.red }}></span>
                      </div>
                      <div className="legend">
                        <span className="lg"><i></i><b>{draft.inspection.green}</b> green</span>
                        <span className="ly"><i></i><b>{draft.inspection.yellow}</b> yellow</span>
                        <span className="lr"><i></i><b>{draft.inspection.red}</b> red</span>
                        <span>{draft.inspection.green + draft.inspection.yellow + draft.inspection.red} items checked</span>
                      </div>
                    </div>
                  </>
                )}

                {draft.baseline.glance.length > 0 && (
                  <>
                    <h3 className="baseline-h3">At a glance</h3>
                    <dl className="glance">
                      {draft.baseline.glance.map((g) => (
                        <div key={g.label}>
                          <dt>{g.label}</dt>
                          <dd>{g.text}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}

                {draft.baseline.detailed.length > 0 && (
                  <>
                    <h3 className="baseline-h3">Detailed baseline</h3>
                    <div className="detailed">
                      {draft.baseline.detailed.map((d) => (
                        <div key={d.heading}>
                          <h4 className="baseline-h4">{d.heading}</h4>
                          {d.paragraphs.map((p, i) => (
                            <p key={i}>{p}</p>
                          ))}
                          {d.bullets.length > 0 && (
                            <ul>
                              {d.bullets.map((b, i) => (
                                <li key={i}>{b}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </section>

            {draft.roadmap.length > 0 && (
              <section id="roadmap">
                <div className="wrap">
                  <p className="kicker">Where it&rsquo;s headed</p>
                  <h2 className="h">What&rsquo;s next, by category</h2>
                  <div className="speccards">
                    {draft.roadmap.map((r) => (
                      <div className="card" key={r.category}>
                        <span className="k">{r.category}</span>
                        <div className="v">{r.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {draft.updates.length > 0 && (
              <section id="updates">
                <div className="wrap">
                  <p className="kicker">The working log</p>
                  <h2 className="h">Updates</h2>
                  <div className="timeline">
                    {draft.updates.map((u, i) => (
                      <div className="entry" key={i}>
                        <div className="date">{u.date}</div>
                        <div>
                          <h5>{u.title}</h5>
                          <p>{u.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        ) : (
          <section>
            <div className="wrap">
              <p className="kicker">Documentation</p>
              <h2 className="h">More to come</h2>
              <p className="lede">
                This build&rsquo;s full write-up -- baseline condition, roadmap, and a working log of updates -- is
                being prepared. Check back soon.
              </p>
            </div>
          </section>
        )}

        {handle && (
          <div className="wrap backlink">
            <a className="cta-link" href={`/builders/${handle}/`}>
              &larr; Back to {handle}
            </a>
          </div>
        )}
      </main>

      {photos.length > 0 && (
        <div className="lightbox" id="lightbox" hidden>
          <button className="lightbox-close" id="lightbox-close" aria-label="Close">
            &times;
          </button>
          <button className="lightbox-prev" id="lightbox-prev" aria-label="Previous photo">
            &larr;
          </button>
          <figure>
            <img id="lightbox-img" src="" alt="" />
            <figcaption>
              <span id="lightbox-cap"></span>
              <span className="lightbox-count" id="lightbox-count"></span>
            </figcaption>
          </figure>
          <button className="lightbox-next" id="lightbox-next" aria-label="Next photo">
            &rarr;
          </button>
        </div>
      )}

      <footer>
        <div className="wrap">
          <span>motori.us: one open record for every build.</span>
        </div>
      </footer>
    </>
  );
}
