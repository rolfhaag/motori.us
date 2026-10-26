import { randomBytes } from "crypto";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError, verifyRequestUser } from "@/lib/verifyRequestUser";
import { SITE_URL } from "@/lib/siteUrl";

export const INVITE_TTL_DAYS = 14;

export interface Spotter {
  id: string;
  user_id: string;
  handle: string;
  display_name: string;
  social_url: string | null;
  status: "active" | "revoked";
}

export function newInviteToken(): string {
  return randomBytes(12).toString("base64url");
}

export function inviteUrl(token: string): string {
  return `${SITE_URL}/spotter/join?t=${encodeURIComponent(token)}`;
}

export function isPlausibleInviteToken(t: unknown): t is string {
  return typeof t === "string" && /^[A-Za-z0-9_-]{8,40}$/.test(t);
}

/** A ready-to-paste DM for the invite. */
export function inviteDmText(name: string | null, url: string): string {
  const hi = name ? `Hey ${name}, ` : "Hey, ";
  return `${hi}I'd love to have you as a Spotter on motori.us: you find cars worth documenting, send the owners a personal link, and get credited when they're featured. Setup takes a minute: ${url}`;
}

/** "gatsbys garage" -> "gatsbys-garage" (3 to 30 chars, lowercase, hyphens). */
export function suggestHandle(name: string | null | undefined): string {
  const h = String(name ?? "")
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
  return h.length >= 3 ? h : "";
}

/** Accepts a https URL or an @handle (treated as Instagram). Returns a clean https URL or null. */
export function normalizeSocial(raw: unknown): string | null | undefined {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (/^@[A-Za-z0-9._]{1,30}$/.test(s)) return `https://www.instagram.com/${s.slice(1)}/`;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (u.protocol !== "https:" || !u.hostname.includes(".") || s.length > 200) return undefined;
    return u.toString();
  } catch {
    return undefined; // invalid
  }
}

/** Short label for a social link, e.g. "instagram.com/gatsbysgarage". */
export function socialLabel(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return url;
  }
}

export async function getSpotterByUser(userId: string): Promise<Spotter | null> {
  const { data } = await getSupabaseAdmin()
    .from("spotters")
    .select("id, user_id, handle, display_name, social_url, status")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as Spotter | null) ?? null;
}

export async function getActiveSpotterByHandle(handle: string): Promise<Spotter | null> {
  const { data } = await getSupabaseAdmin()
    .from("spotters")
    .select("id, user_id, handle, display_name, social_url, status")
    .eq("handle", handle)
    .eq("status", "active")
    .maybeSingle();
  return (data as Spotter | null) ?? null;
}

/** Verified caller who is an active Spotter. */
export async function requireSpotter(req: NextRequest) {
  const { privyUserId } = await verifyRequestUser(req);
  const spotter = await getSpotterByUser(privyUserId);
  if (!spotter) throw new AuthError("Spotter access required.", 403);
  if (spotter.status !== "active") throw new AuthError("Your Spotter access is paused.", 403);
  return { privyUserId, spotter };
}

export type InviteState = "open" | "used" | "expired" | "revoked";

export function inviteState(i: { used_at: string | null; revoked_at: string | null; expires_at: string }): InviteState {
  if (i.revoked_at) return "revoked";
  if (i.used_at) return "used";
  if (new Date(i.expires_at).getTime() < Date.now()) return "expired";
  return "open";
}

export type NominationStatus = "sent" | "applied" | "approved" | "live";

/** Where a car this Spotter nominated stands. Denials are never shown: anything undecided or declined reads "applied". */
export async function nominationStatuses(
  spotterId: string,
  nominations: { id: string; claimed_application_id: string | null }[]
): Promise<Map<string, { status: NominationStatus; buildUrl: string | null }>> {
  const supabase = getSupabaseAdmin();
  const out = new Map<string, { status: NominationStatus; buildUrl: string | null }>();
  const appIds = nominations.map((n) => n.claimed_application_id).filter(Boolean) as string[];
  const { data: apps } = appIds.length
    ? await supabase.from("applications").select("id, user_id, status").in("id", appIds)
    : { data: [] as { id: string; user_id: string; status: string }[] };
  const appById = new Map((apps ?? []).map((a) => [a.id, a]));

  const approvedUserIds = (apps ?? []).filter((a) => a.status === "approved").map((a) => a.user_id);
  const { data: builds } = approvedUserIds.length
    ? await supabase
        .from("builds")
        .select("slug, builder_id, hidden, visibility")
        .in("builder_id", approvedUserIds)
        .eq("spotted_by_spotter_id", spotterId)
        .eq("status", "published")
        .eq("hidden", false)
        .not("slug", "is", null)
    : { data: [] as { slug: string; builder_id: string; hidden: boolean; visibility: string }[] };

  for (const n of nominations) {
    if (!n.claimed_application_id) {
      out.set(n.id, { status: "sent", buildUrl: null });
      continue;
    }
    const app = appById.get(n.claimed_application_id);
    if (!app || app.status !== "approved") {
      out.set(n.id, { status: "applied", buildUrl: null });
      continue;
    }
    const live = (builds ?? []).find((b) => b.builder_id === app.user_id && b.visibility !== "private");
    out.set(n.id, live ? { status: "live", buildUrl: `/builds/${live.slug}/` } : { status: "approved", buildUrl: null });
  }
  return out;
}

/**
 * The Builder answered "Credit your Spotter for spotting this car?" on the
 * build form. "1" credits the Spotter who brought them in; "0" doesn't.
 * Either answer means they won't be asked again for later builds.
 */
export async function applySpotterCredit(builderId: string, buildId: string, value: FormDataEntryValue | null) {
  if (value !== "1" && value !== "0") return;
  const supabase = getSupabaseAdmin();
  const { data: builder } = await supabase
    .from("builders")
    .select("brought_by_spotter_id")
    .eq("user_id", builderId)
    .maybeSingle();
  if (!builder?.brought_by_spotter_id) return;
  const { data: build } = await supabase.from("builds").select("status").eq("id", buildId).eq("builder_id", builderId).maybeSingle();
  if (!build || build.status === "published") return;
  await supabase
    .from("builds")
    .update({ spotted_by_spotter_id: value === "1" ? builder.brought_by_spotter_id : null })
    .eq("id", buildId);
  await supabase.from("builders").update({ spotter_credit_answered: true }).eq("user_id", builderId);
}
