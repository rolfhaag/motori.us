import { randomBytes } from "crypto";
import type { NextRequest } from "next/server";
import { builderName, builderNames } from "@/lib/names";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { SITE_URL } from "@/lib/siteUrl";
import { requestMeta } from "@/lib/legal/server";
import { sendEmail } from "@/lib/email/send";
import { subscribeConfirm } from "@/lib/email/templates";

/**
 * Following: email subscriptions to the whole site, one Builder, or one Build.
 * Double opt-in (nothing is sent until the person confirms), one-click
 * unsubscribe, and a record of the wording shown and when it was confirmed.
 */

export type Scope = "site" | `builder:${string}` | `build:${string}`;

const HANDLE_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_RE = /^[A-Za-z0-9_-]{4,60}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const CONSENT_TEXT =
  "Email me when there's something new. I can unsubscribe any time. See the Privacy Policy.";

/** Postal address printed in every update email (required for commercial email). */
export function postalAddress(): string | null {
  return process.env.LEGAL_POSTAL_ADDRESS?.trim() || null;
}

export function normalizeEmail(raw: unknown): string | null {
  const e = String(raw ?? "").trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}

export function parseScope(raw: unknown): Scope | null {
  const s = String(raw ?? "").trim();
  if (s === "site") return "site";
  if (s.startsWith("builder:") && HANDLE_RE.test(s.slice(8)) && s.length <= 38) return s as Scope;
  if (s.startsWith("build:") && SLUG_RE.test(s.slice(6))) return s as Scope;
  return null;
}

/** "new builds by Mahlzeit Motorsport", for emails and pages. Null if the target doesn't exist. */
export async function scopeLabel(scope: Scope): Promise<string | null> {
  if (scope === "site") return "new builds on motori.us";
  const supabase = getSupabaseAdmin();
  if (scope.startsWith("builder:")) {
    const handle = scope.slice(8);
    const { data } = await supabase.from("builders").select("handle, hidden").eq("handle", handle).maybeSingle();
    if (!data || data.hidden) return null;
    return `new builds by ${await builderName(handle)}`;
  }
  const slug = scope.slice(6);
  const { data } = await supabase
    .from("builds")
    .select("title, hidden, status, visibility")
    .eq("slug", slug)
    .maybeSingle();
  if (!data || data.hidden || data.status !== "published" || data.visibility === "private") return null;
  return `updates to ${data.title}`;
}

function newToken() {
  return randomBytes(24).toString("base64url");
}

export type SubscribeResult =
  | { ok: true; state: "confirmation_sent" | "already_confirmed" }
  | { ok: false; status: number; error: string };

export async function subscribe(
  req: NextRequest,
  emailRaw: unknown,
  scopeRaw: unknown,
  source: string | null
): Promise<SubscribeResult> {
  const email = normalizeEmail(emailRaw);
  if (!email) return { ok: false, status: 400, error: "Please enter a valid email address." };
  const scope = parseScope(scopeRaw);
  if (!scope) return { ok: false, status: 400, error: "That isn't something you can follow." };
  const label = await scopeLabel(scope);
  if (!label) return { ok: false, status: 404, error: "That page isn't available to follow." };

  const supabase = getSupabaseAdmin();
  const meta = requestMeta(req);

  // Basic abuse guard: many signups from one address in an hour.
  if (meta.ip) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("email_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("ip", meta.ip)
      .gte("created_at", since);
    if ((count ?? 0) >= 12) {
      return { ok: false, status: 429, error: "Too many sign-ups from this connection. Please try again later." };
    }
  }

  const { data: existing } = await supabase
    .from("email_subscriptions")
    .select("id, status, token, confirm_sent_at")
    .eq("email", email)
    .eq("scope", scope)
    .maybeSingle();

  if (existing?.status === "confirmed") return { ok: true, state: "already_confirmed" };

  let id = existing?.id as string | undefined;
  let token = existing?.token as string | undefined;
  const nowIso = new Date().toISOString();

  if (existing) {
    // Pending or previously unsubscribed: throttle repeat confirmation emails.
    if (
      existing.status === "pending" &&
      existing.confirm_sent_at &&
      Date.now() - new Date(existing.confirm_sent_at).getTime() < 10 * 60 * 1000
    ) {
      return { ok: true, state: "confirmation_sent" };
    }
    await supabase
      .from("email_subscriptions")
      .update({
        status: "pending",
        unsubscribed_at: null,
        consent_text: CONSENT_TEXT,
        source,
        ip: meta.ip,
        user_agent: meta.userAgent,
      })
      .eq("id", existing.id);
  } else {
    token = newToken();
    const { data: row, error } = await supabase
      .from("email_subscriptions")
      .insert({
        email,
        scope,
        token,
        status: "pending",
        source,
        consent_text: CONSENT_TEXT,
        ip: meta.ip,
        user_agent: meta.userAgent,
      })
      .select("id")
      .single();
    if (error || !row) return { ok: false, status: 500, error: "Could not sign you up. Please try again." };
    id = row.id;
  }

  const mail = subscribeConfirm({ scopeLabel: label, confirmUrl: `${SITE_URL}/subscribe/confirm?token=${token}` });
  const sent = await sendEmail({
    to: email,
    template: "subscribe-confirm",
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    dedupeKey: `sub-confirm:${id}:${nowIso}`,
  });
  if (!sent.ok) return { ok: false, status: 502, error: "We couldn't send the confirmation email. Please try again." };
  await supabase.from("email_subscriptions").update({ confirm_sent_at: nowIso }).eq("id", id!);
  return { ok: true, state: "confirmation_sent" };
}

export interface SubscriptionInfo {
  id: string;
  email: string;
  scope: Scope;
  status: "pending" | "confirmed" | "unsubscribed";
  confirmedAt: string | null;
}

export async function getByToken(token: unknown): Promise<SubscriptionInfo | null> {
  const t = String(token ?? "");
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(t)) return null;
  const { data } = await getSupabaseAdmin()
    .from("email_subscriptions")
    .select("id, email, scope, status, confirmed_at")
    .eq("token", t)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    email: data.email,
    scope: data.scope as Scope,
    status: data.status,
    confirmedAt: data.confirmed_at,
  };
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  return `${user.slice(0, 1)}${"•".repeat(Math.max(1, Math.min(user.length - 1, 6)))}@${domain}`;
}

export async function confirm(info: SubscriptionInfo) {
  if (info.status === "confirmed") return;
  await getSupabaseAdmin()
    .from("email_subscriptions")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString(), unsubscribed_at: null })
    .eq("id", info.id);
}

/** Unsubscribes this follow, or every follow for the same address when `all`. */
export async function unsubscribe(info: SubscriptionInfo, all: boolean) {
  const q = getSupabaseAdmin()
    .from("email_subscriptions")
    .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() });
  if (all) await q.eq("email", info.email).neq("status", "unsubscribed");
  else await q.eq("id", info.id);
}

export async function resubscribe(info: SubscriptionInfo) {
  await getSupabaseAdmin()
    .from("email_subscriptions")
    .update({ status: info.confirmedAt ? "confirmed" : "pending", unsubscribed_at: null })
    .eq("id", info.id);
}

export interface Recipient {
  email: string;
  token: string; // unsubscribe token (of the most specific matching follow)
}

/** Confirmed followers for the given scopes, one entry per email address. */
export async function recipientsForScopes(scopes: Scope[]): Promise<Recipient[]> {
  if (scopes.length === 0) return [];
  const { data } = await getSupabaseAdmin()
    .from("email_subscriptions")
    .select("email, token, scope")
    .eq("status", "confirmed")
    .in("scope", scopes);
  const byEmail = new Map<string, Recipient>();
  for (const r of data ?? []) if (!byEmail.has(r.email)) byEmail.set(r.email, { email: r.email, token: r.token });
  return [...byEmail.values()];
}

export async function allRecipients(): Promise<Recipient[]> {
  const { data } = await getSupabaseAdmin()
    .from("email_subscriptions")
    .select("email, token")
    .eq("status", "confirmed");
  const byEmail = new Map<string, Recipient>();
  for (const r of data ?? []) if (!byEmail.has(r.email)) byEmail.set(r.email, { email: r.email, token: r.token });
  return [...byEmail.values()];
}

export function unsubscribeUrls(token: string) {
  return {
    page: `${SITE_URL}/unsubscribe?token=${token}`,
    oneClick: `${SITE_URL}/api/unsubscribe?token=${token}`,
  };
}

/** Headers that make Gmail/Apple Mail show their own "Unsubscribe" control (RFC 8058). */
export function unsubscribeHeaders(token: string): Record<string, string> {
  const u = unsubscribeUrls(token);
  return {
    "List-Unsubscribe": `<${u.oneClick}>, <mailto:team@motori.us?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

// ---------------------------------------------------------------------------
// Signed-in follows: the person is logged in with a verified email, so
// pressing Follow is the consent (no confirmation email). These are the same
// email_subscriptions rows as email-only follows, matched by email address,
// so an earlier email-only follow shows up once that person signs up.
// ---------------------------------------------------------------------------

export const ACCOUNT_CONSENT_TEXT =
  "Followed while signed in to motori.us: email me news about this. I can unsubscribe any time.";

/** The email we can trust for a signed-in user: Privy-verified, else the one stored at sign-in. */
export async function accountEmail(privyUserId: string, verified: string | null): Promise<string | null> {
  if (verified) return normalizeEmail(verified);
  const { data } = await getSupabaseAdmin().from("users").select("email").eq("id", privyUserId).maybeSingle();
  return normalizeEmail(data?.email);
}

export type FollowResult = { ok: true } | { ok: false; status: number; error: string };

export async function followAsUser(req: NextRequest, email: string, scopeRaw: unknown): Promise<FollowResult> {
  const scope = parseScope(scopeRaw);
  if (!scope) return { ok: false, status: 400, error: "That isn't something you can follow." };
  if (!(await scopeLabel(scope))) return { ok: false, status: 404, error: "That page isn't available to follow." };

  const supabase = getSupabaseAdmin();
  const meta = requestMeta(req);
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("email_subscriptions")
    .select("id, status")
    .eq("email", email)
    .eq("scope", scope)
    .maybeSingle();

  if (existing) {
    if (existing.status === "confirmed") return { ok: true };
    const { error } = await supabase
      .from("email_subscriptions")
      .update({
        status: "confirmed",
        confirmed_at: now,
        unsubscribed_at: null,
        consent_text: ACCOUNT_CONSENT_TEXT,
        source: "account",
        ip: meta.ip,
        user_agent: meta.userAgent,
      })
      .eq("id", existing.id);
    if (error) return { ok: false, status: 500, error: "Could not follow. Please try again." };
    return { ok: true };
  }
  const { error } = await supabase.from("email_subscriptions").insert({
    email,
    scope,
    token: newToken(),
    status: "confirmed",
    confirmed_at: now,
    source: "account",
    consent_text: ACCOUNT_CONSENT_TEXT,
    ip: meta.ip,
    user_agent: meta.userAgent,
  });
  if (error) return { ok: false, status: 500, error: "Could not follow. Please try again." };
  return { ok: true };
}

export async function unfollowAsUser(email: string, scopeRaw: unknown): Promise<FollowResult> {
  const scope = parseScope(scopeRaw);
  if (!scope) return { ok: false, status: 400, error: "That isn't something you can follow." };
  await getSupabaseAdmin()
    .from("email_subscriptions")
    .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
    .eq("email", email)
    .eq("scope", scope)
    .neq("status", "unsubscribed");
  return { ok: true };
}

export interface FollowItem {
  scope: Scope;
  kind: "site" | "builder" | "build";
  title: string;
  subtitle: string | null;
  url: string;
}

/** Everything this email address follows (confirmed), with display details. */
export async function listFollows(email: string): Promise<FollowItem[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("email_subscriptions")
    .select("scope, confirmed_at")
    .eq("email", email)
    .eq("status", "confirmed")
    .order("confirmed_at", { ascending: false });
  const scopes = (data ?? []).map((r) => r.scope as Scope);

  const slugs = scopes.filter((s) => s.startsWith("build:")).map((s) => s.slice(6));
  const { data: builds } = slugs.length
    ? await supabase.from("builds").select("slug, title, hidden, status, visibility, user_id").in("slug", slugs)
    : { data: [] as { slug: string; title: string; hidden: boolean; status: string; visibility: string; user_id: string }[] };
  const buildBySlug = new Map((builds ?? []).map((b) => [b.slug, b]));

  const bNames = await builderNames(scopes.filter((s) => s.startsWith("builder:")).map((s) => s.slice(8)));
  const items: FollowItem[] = [];
  for (const scope of scopes) {
    if (scope === "site") {
      items.push({ scope, kind: "site", title: "New builds on motori.us", subtitle: null, url: "/" });
    } else if (scope.startsWith("builder:")) {
      const handle = scope.slice(8);
      items.push({ scope, kind: "builder", title: bNames.get(handle) ?? handle, subtitle: "Builder", url: `/builders/${handle}/` });
    } else {
      const b = buildBySlug.get(scope.slice(6));
      if (b && !b.hidden && b.status === "published") {
        items.push({ scope, kind: "build", title: b.title, subtitle: "Build", url: `/builds/${b.slug}/` });
      } else {
        // Keep it listed so it can still be unfollowed, even if the page is gone.
        items.push({ scope, kind: "build", title: "A build that's no longer available", subtitle: "Build", url: "" });
      }
    }
  }
  return items;
}
