export const E9_SLUG = "71e9S38B36";
// Front, side profile, dash, cockpit, engine bay, underneath (driveshaft).
export const E9_SHARE_PHOTOS = [
  "e9-front.jpg",
  "e9-side.jpg",
  "e9-interior-dash.jpg",
  "e9-int-cockpit.jpg",
  "e9-engine.jpg",
  "e9-mech-driveshaft.jpg",
];
export const SHARE_IMAGE_COUNT = 6;

interface SharePhotoMeta {
  caption?: string;
  category?: string;
}

/**
 * Which photos go in the share set, as indexes into the Build's photo list:
 * the hero first, then one more exterior, two interior, one engine bay and
 * one underneath. Engine bay / underneath are found from the photo captions.
 * Anything missing is topped up from the remaining photos in order, so a
 * Build without, say, an underside shot still gets a full set.
 */
export function pickShareIndexes(photos: SharePhotoMeta[]): number[] {
  const used = new Set<number>();
  const out: number[] = [];
  const take = (i: number | undefined) => {
    if (i === undefined || used.has(i) || i >= photos.length) return;
    used.add(i);
    out.push(i);
  };
  const find = (test: (p: SharePhotoMeta) => boolean) => photos.findIndex((p, i) => !used.has(i) && test(p));
  const cat = (c: string) => (p: SharePhotoMeta) => (p.category || "exterior") === c;
  const cap = (re: RegExp) => (p: SharePhotoMeta) => re.test(p.caption ?? "");
  const idx = (n: number) => (n < 0 ? undefined : n);

  if (photos.length === 0) return [];
  take(0); // hero: its shape sets the frame for the whole set
  // Second exterior: a side-profile shot if there is one, else the next exterior.
  const side = find((p) => cat("exterior")(p) && /\b(side|profile)\b/i.test(p.caption ?? ""));
  take(idx(side >= 0 ? side : find(cat("exterior"))));
  take(idx(find(cat("interior"))));
  take(idx(find(cat("interior"))));
  const bay = find((p) => /engine bay/i.test(p.caption ?? ""));
  take(idx(bay >= 0 ? bay : find(cap(/engine/i))));
  take(idx(find(cap(/underside|underneath|undercarriage|driveshaft|differential|subframe/i))));
  for (let i = 0; i < photos.length && out.length < SHARE_IMAGE_COUNT; i++) take(i);
  return out.slice(0, SHARE_IMAGE_COUNT);
}

const tag = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Default caption for a Build; the Builder can edit it before sharing. */
export function buildCaption(opts: {
  title: string;
  thesis: string | null;
  url: string;
  make: string | null;
  model: string | null;
}): string {
  const tags = Array.from(
    new Set([tag(opts.make), tag(opts.model), "restomod", "classiccars", "motori"].filter(Boolean))
  )
    .map((t) => `#${t}`)
    .join(" ");
  return [
    opts.title,
    opts.thesis ? opts.thesis : null,
    `Every finding, part and decision, documented: ${opts.url}`,
    tags,
  ]
    .filter(Boolean)
    .join("\n\n");
}
