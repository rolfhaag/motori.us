import { createHmac, randomInt, scryptSync, timingSafeEqual } from "crypto";

// No 0/O/1/l/I so a password read aloud or typed from a text is unambiguous.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
export const ACCESS_PASSWORD_LENGTH = 12;

export function generateAccessPassword(): string {
  let out = "";
  for (let i = 0; i < ACCESS_PASSWORD_LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export function hashAccessPassword(password: string): string {
  const salt = Buffer.from(Array.from({ length: 16 }, () => randomInt(256)));
  const hash = scryptSync(password, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyAccessPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

function secret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  return s;
}

export function accessCookieName(slug: string): string {
  return `mb_${slug}`;
}

/**
 * Cookie value proving the visitor entered the right password. Bound to the
 * password hash, so regenerating the password invalidates every old cookie.
 */
export function accessCookieValue(slug: string, storedHash: string): string {
  return createHmac("sha256", secret()).update(`${slug}:${storedHash}`).digest("hex");
}

export function hasAccess(slug: string, storedHash: string | null, cookieValue: string | undefined): boolean {
  if (!storedHash || !cookieValue) return false;
  const expected = Buffer.from(accessCookieValue(slug, storedHash));
  const given = Buffer.from(cookieValue);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
