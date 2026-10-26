import { normalizeSocial } from "@/lib/spotters";

export interface SocialLink {
  label: string;
  url: string | null;
}

/**
 * Turns the free-text socials a Builder typed ("@name", "instagram.com/name",
 * several separated by spaces, commas or lines) into safe https links. Anything
 * that isn't a clean link or @handle is kept as plain text, never as a link.
 */
export function parseSocials(raw: string | null | undefined): SocialLink[] {
  const parts = String(raw ?? "")
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 5);
  return parts.map((p) => {
    const url = normalizeSocial(p);
    if (!url) return { label: p.slice(0, 60), url: null };
    const label = p.startsWith("@") ? p : url.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "");
    return { label: label.slice(0, 60), url };
  });
}
