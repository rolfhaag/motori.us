import { createHmac, timingSafeEqual } from "crypto";
import { SITE_URL } from "@/lib/siteUrl";

/**
 * Email hero images. Photos live in private buckets, and signed storage URLs
 * expire, which would break images in an email read days later. Instead the
 * email points at /api/email-image/<kind>/<id>, which serves the current
 * first photo and is protected by an HMAC signature (unguessable, no expiry,
 * no login needed -- an email client can't log in).
 */

export type ImageKind = "app" | "build";

function secret(): string {
  const s = process.env.EMAIL_IMAGE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("No secret available to sign email images.");
  return s;
}

function sign(kind: ImageKind, id: string, v: string): string {
  return createHmac("sha256", secret()).update(`${kind}:${id}:${v}`).digest("hex").slice(0, 32);
}

/** Short fingerprint of the photo path so the URL changes when the hero does. */
function version(path: string): string {
  return createHmac("sha256", "v").update(path).digest("hex").slice(0, 8);
}

export function heroImageUrl(kind: ImageKind, id: string, firstPhotoPath: string | null | undefined): string | null {
  if (!firstPhotoPath) return null;
  try {
    const v = version(firstPhotoPath);
    return `${SITE_URL}/api/email-image/${kind}/${id}?v=${v}&s=${sign(kind, id, v)}`;
  } catch {
    return null;
  }
}

export function verifyImageSignature(kind: ImageKind, id: string, v: string, s: string): boolean {
  try {
    const expected = Buffer.from(sign(kind, id, v));
    const given = Buffer.from(s);
    return expected.length === given.length && timingSafeEqual(expected, given);
  } catch {
    return false;
  }
}
