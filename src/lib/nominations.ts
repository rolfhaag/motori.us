import { randomBytes } from "crypto";
import { SITE_URL } from "@/lib/siteUrl";

export const NOMINATIONS_PER_DAY = 60;

export function newNominationToken(): string {
  return randomBytes(9).toString("base64url"); // 12 URL-safe characters
}

export function nominationUrl(token: string): string {
  return `${SITE_URL}/apply/?n=${encodeURIComponent(token)}`;
}

export function isPlausibleToken(t: unknown): t is string {
  return typeof t === "string" && /^[A-Za-z0-9_-]{8,32}$/.test(t);
}
