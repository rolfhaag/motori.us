import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { SITE_URL } from "@/lib/siteUrl";
import { displayName } from "@/lib/builderListings";
import {
  postalAddress,
  recipientsForScopes,
  unsubscribeHeaders,
  unsubscribeUrls,
  type Recipient,
  type Scope,
} from "@/lib/follow";
import { heroImageUrl } from "./heroImage";
import { sendEmail } from "./send";
import { broadcastEmail, newBuildAnnouncement, type RenderedEmail } from "./templates";
import type { BuildPhoto } from "@/lib/buildAssets";

/** Resend allows about 2 requests a second by default; stay comfortably under. */
const SPACING_MS = 600;
export const MAX_RECIPIENTS_PER_SEND = 200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sends one email per follower (each with their own unsubscribe link and
 * headers), slowly and idempotently. Refuses to send commercial email without
 * a postal address configured. Never throws.
 */
async function deliver(
  recipients: Recipient[],
  template: string,
  dedupePrefix: string,
  build: (r: Recipient, marketing: { reason: string; unsubscribeUrl: string; postalAddress: string }) => RenderedEmail,
  reason: string
): Promise<{ sent: number; failed: number; skipped: number }> {
  const result = { sent: 0, failed: 0, skipped: 0 };
  const address = postalAddress();
  if (!address) {
    console.error("[followers] LEGAL_POSTAL_ADDRESS is not set; not sending update emails.");
    result.failed = recipients.length;
    return result;
  }
  let first = true;
  for (const r of recipients.slice(0, MAX_RECIPIENTS_PER_SEND)) {
    try {
      const urls = unsubscribeUrls(r.token);
      const mail = build(r, { reason, unsubscribeUrl: urls.page, postalAddress: address });
      if (!first) await sleep(SPACING_MS);
      first = false;
      const res = await sendEmail({
        to: r.email,
        template,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        dedupeKey: `${dedupePrefix}:${r.email}`,
        headers: unsubscribeHeaders(r.token),
      });
      if (!res.ok) result.failed++;
      else if (res.skipped) result.skipped++;
      else result.sent++;
    } catch (err) {
      console.error("[followers] delivery error:", err);
      result.failed++;
    }
  }
  return result;
}

/** A Build just went public: tell followers of the site and of its Builder. Once per Build. */
export async function notifyFollowersOfNewBuild(buildId: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: build } = await supabase
      .from("builds")
      .select("id, builder_id, title, slug, status, visibility, hidden, photos, draft_content")
      .eq("id", buildId)
      .maybeSingle();
    if (!build || build.status !== "published" || build.visibility === "private" || build.hidden || !build.slug) return;
    const { data: builder } = await supabase.from("builders").select("handle").eq("user_id", build.builder_id).maybeSingle();
    if (!builder) return;
    const handle = builder.handle as string;

    const recipients = await recipientsForScopes(["site", `builder:${handle}` as Scope]);
    if (recipients.length === 0) return;

    const photos = (build.photos ?? []) as BuildPhoto[];
    const thesis = (build.draft_content as { hero?: { thesis?: string } } | null)?.hero?.thesis ?? null;
    const heroUrl = heroImageUrl("build", build.id, photos[0]?.path);
    const pageUrl = `${SITE_URL}/builds/${build.slug}`;

    await deliver(
      recipients,
      "new-build-announcement",
      `build-announce:${build.id}`,
      (_r, marketing) =>
        newBuildAnnouncement({
          buildTitle: build.title,
          builderName: displayName(handle),
          blurb: thesis,
          heroUrl,
          pageUrl,
          marketing,
        }),
      `You’re getting this because you follow ${displayName(handle)} or new builds on motori.us.`
    );
  } catch (err) {
    console.error("[followers] notifyFollowersOfNewBuild failed:", err);
  }
}

export interface BroadcastInput {
  id: string; // unique per send, makes retries safe
  subject: string;
  lead: string;
  paragraphs: string[];
  buttonLabel?: string | null;
  buttonUrl?: string | null;
  recipients: Recipient[];
}

export async function sendBroadcast(input: BroadcastInput) {
  return deliver(
    input.recipients,
    "broadcast",
    `broadcast:${input.id}`,
    (_r, marketing) =>
      broadcastEmail({
        subject: input.subject,
        lead: input.lead,
        paragraphs: input.paragraphs,
        buttonLabel: input.buttonLabel,
        buttonUrl: input.buttonUrl,
        marketing,
      }),
    "You’re getting this because you follow motori.us."
  );
}
