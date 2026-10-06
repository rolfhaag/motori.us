export const E9_SLUG = "71e9S38B36";
export const E9_SHARE_PHOTOS = ["e9-front.jpg", "e9-side.jpg", "e9-rear.jpg", "e9-ext-fog.jpg", "e9-detail.jpg"];
export const SHARE_IMAGE_COUNT = 5; // hero + up to 4 more

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
