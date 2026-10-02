import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";

/**
 * Cache-busting query strings for the static files under public/assets/,
 * which the legacy pages load via plain <link>/<script> tags instead of
 * Next's hashed-by-default bundling. Without this, a deploy that only
 * changes site.css/site.js keeps the same URL, so a browser (Safari's
 * cache in particular tends to be the one that sticks) can keep serving a
 * stale copy indefinitely. Hashing the file's own content at build time
 * means the query string -- and so the cache key -- only changes when the
 * file actually does.
 */
function hashAsset(relPath: string): string {
  try {
    const full = path.join(process.cwd(), "public", "assets", relPath);
    return createHash("sha1").update(readFileSync(full)).digest("hex").slice(0, 10);
  } catch {
    // Missing file shouldn't break the build; worst case this asset just
    // isn't cache-busted.
    return "0";
  }
}

const versions = {
  "site.css": hashAsset("site.css"),
  "site.js": hashAsset("site.js"),
  "qr.js": hashAsset("qr.js"),
  "qrcode.min.js": hashAsset("qrcode.min.js"),
} as const;

export function versionedAsset(name: keyof typeof versions): string {
  return `/assets/${name}?v=${versions[name]}`;
}
