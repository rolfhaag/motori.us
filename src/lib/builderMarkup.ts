import { esc } from "@/lib/email/layout";
import type { ListedBuild, ListedBuilder } from "@/lib/builderListings";

/** HTML for the home page's Builder blocks (builders listed vertically,
 *  each Builder's builds in a swipeable row when there is more than one). */
export function homeBuilderBlocksHtml(builders: ListedBuilder[]): string {
  if (builders.length === 0) {
    return `<p class="builderblock-tag">No builds published yet. Check back soon.</p>`;
  }
  return builders.map(blockHtml).join("\n");
}

function thumbHtml(b: ListedBuild): string {
  const img = b.imageSrc
    ? `<img src="${esc(b.imageSrc)}" alt="${esc(b.title)}" loading="lazy">`
    : `<span class="ph">photo coming</span>`;
  return `<a class="buildthumb" href="/builds/${esc(b.slug)}/">
    <div class="thumb">${img}</div>
    <div class="info">
      <span class="no">Build ${String(b.no).padStart(2, "0")}</span>
      <h4>${esc(b.title)}</h4>
      ${b.blurb ? `<p>${esc(b.blurb)}</p>` : ""}
    </div>
  </a>`;
}

function blockHtml(builder: ListedBuilder): string {
  if (builder.builds.length === 0) {
    return `<div class="builderblock">
    <div class="builderblock-head">
      <a class="bname" href="/builders/${esc(builder.handle)}/"><h3 class="h3">${esc(builder.name)}</h3></a>
      <a class="viewprofile" href="/builders/${esc(builder.handle)}/">View builder &#8594;</a>
    </div>
    ${builder.tagline ? `<p class="builderblock-tag">${esc(builder.tagline)}</p>` : ""}
    <div class="thumbgrid single">
      <a class="buildthumb comingsoon" href="/builders/${esc(builder.handle)}/">
        <div class="thumb"><span class="ph">coming soon</span></div>
        <div class="info">
          <span class="no">Build 01</span>
          <h4>Coming soon</h4>
          <p>${esc(builder.name)}&rsquo;s first documented build is on its way.</p>
        </div>
      </a>
    </div>
  </div>`;
  }
  const many = builder.builds.length > 1;
  const row = many
    ? `<div class="carousel" data-carousel>
        <button class="carousel-btn prev" type="button" data-carousel-prev aria-label="Previous build" hidden>&#8592;</button>
        <div class="carousel-track" tabindex="0" aria-label="${esc(builder.name)} builds, swipe sideways">
          ${builder.builds.map(thumbHtml).join("\n")}
        </div>
        <button class="carousel-btn next" type="button" data-carousel-next aria-label="Next build" hidden>&#8594;</button>
      </div>`
    : `<div class="thumbgrid single">${builder.builds.map(thumbHtml).join("\n")}</div>`;
  return `<div class="builderblock">
    <div class="builderblock-head">
      <a class="bname" href="/builders/${esc(builder.handle)}/"><h3 class="h3">${esc(builder.name)}</h3></a>
      <a class="viewprofile" href="/builders/${esc(builder.handle)}/">View builder &#8594;</a>
    </div>
    ${builder.tagline ? `<p class="builderblock-tag">${esc(builder.tagline)}</p>` : ""}
    ${row}
  </div>`;
}

/** HTML for a Builder page's list of builds: one column, scrolling down. */
export function builderBuildsHtml(builder: ListedBuilder): string {
  const cards = builder.builds.map(
    (b) => `<a class="buildcard" href="/builds/${esc(b.slug)}/">
      ${b.imageSrc ? `<div class="thumb"><img src="${esc(b.imageSrc)}" alt="${esc(b.title)}" loading="lazy"></div>` : ""}
      <span class="no">Build ${String(b.no).padStart(2, "0")}</span>
      <h4>${esc(b.title)}</h4>
      ${b.blurb ? `<p>${esc(b.blurb)}</p>` : ""}
      <span class="go">Read the record &#8594;</span>
    </a>`
  );
  // The dashed "Coming next" card stays last: for the owning Builder the
  // nav script turns it into an "Add a Build" shortcut.
  const next = String(builder.builds.length + 1).padStart(2, "0");
  cards.push(`<div class="buildcard pending">
      <span class="no">Build ${next}</span>
      <h4>Coming next</h4>
      <p>More builds join the roster as they come into the shop. This card fills in when the next one starts.</p>
    </div>`);
  return `<div class="buildstack">${cards.join("\n")}</div>`;
}
