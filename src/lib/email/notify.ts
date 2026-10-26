import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { SITE_URL } from "@/lib/siteUrl";
import { sendEmail, TEAM_EMAIL } from "./send";
import { heroImageUrl } from "./heroImage";
import {
  adminApplicationSubmitted,
  adminBuildSubmitted,
  applicationApproved,
  applicationDenied,
  applicationNeedsChanges,
  applicationReceived,
  buildApprovedLive,
  buildDenied,
  buildNeedsChanges,
  buildReceived,
  nudgeApplication,
  nudgeBuild,
  type RenderedEmail,
} from "./templates";
import type { BuildPhoto } from "@/lib/buildAssets";

/**
 * Event hooks. Each one loads what it needs, renders, and sends -- and never
 * throws, so callers can run it fire-and-forget (via next/server `after`).
 * Emails go to the address Privy already gave us (users.email).
 */

function safely<A extends unknown[]>(name: string, fn: (...args: A) => Promise<void>) {
  return async (...args: A) => {
    try {
      await fn(...args);
    } catch (err) {
      console.error(`[email] ${name} failed:`, err);
    }
  };
}

function when(): string {
  return new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

async function emailForUser(userId: string): Promise<string | null> {
  const { data } = await getSupabaseAdmin().from("users").select("email").eq("id", userId).maybeSingle();
  return data?.email ?? null;
}

async function send(to: string | null, template: string, mail: RenderedEmail, dedupeKey?: string) {
  if (!to) return;
  await sendEmail({ to, template, dedupeKey, ...mail });
}

// ----------------------------------------------------------- applications

export const notifyApplicationSubmitted = safely(
  "notifyApplicationSubmitted",
  async (applicationId: string, opts: { resubmitted: boolean; priorNote?: string | null; stamp: string }) => {
    const { data: app } = await getSupabaseAdmin()
      .from("applications")
      .select("id, user_id, handle, photos, nominated_by, spotter_id")
      .eq("id", applicationId)
      .maybeSingle();
    if (!app) return;
    const photos = (app.photos ?? []) as string[];
    let nominatedBy: string | null = null;
    if (app.nominated_by) {
      const { data: nominator } = await getSupabaseAdmin()
        .from("builders")
        .select("handle")
        .eq("user_id", app.nominated_by)
        .maybeSingle();
      nominatedBy = nominator?.handle ?? null;
    } else if (app.spotter_id) {
      const { data: sp } = await getSupabaseAdmin()
        .from("spotters")
        .select("display_name, handle")
        .eq("id", app.spotter_id)
        .maybeSingle();
      nominatedBy = sp ? `Spotter ${sp.display_name} (@${sp.handle})` : null;
    }

    await send(
      TEAM_EMAIL,
      "admin-application",
      adminApplicationSubmitted({
        handle: app.handle,
        resubmitted: opts.resubmitted,
        submittedAt: when(),
        photoCount: photos.length,
        priorNote: opts.priorNote,
        heroUrl: heroImageUrl("app", app.id, photos[0]),
        nominatedBy,
      }),
      `admin-application:${app.id}:${opts.stamp}`
    );
    await send(
      await emailForUser(app.user_id),
      "application-received",
      applicationReceived(),
      `application-received:${app.id}:${opts.stamp}`
    );
  }
);

export const notifyApplicationDecided = safely(
  "notifyApplicationDecided",
  async (
    applicationId: string,
    outcome: "approved" | "needs_changes" | "denied",
    opts: { note?: string | null; stamp: string }
  ) => {
    const { data: app } = await getSupabaseAdmin()
      .from("applications")
      .select("id, user_id, handle")
      .eq("id", applicationId)
      .maybeSingle();
    if (!app) return;
    const to = await emailForUser(app.user_id);
    const data = { handle: app.handle, note: opts.note };
    const key = `application-${outcome}:${app.id}:${opts.stamp}`;

    if (outcome === "approved") await send(to, "application-approved", applicationApproved(data), key);
    else if (outcome === "needs_changes")
      await send(to, "application-needs-changes", applicationNeedsChanges(data), key);
    else await send(to, "application-denied", applicationDenied(data), key);
  }
);

// ----------------------------------------------------------------- builds

async function loadBuild(buildId: string) {
  const supabase = getSupabaseAdmin();
  const { data: build } = await supabase
    .from("builds")
    .select("id, builder_id, title, slug, photos, documents")
    .eq("id", buildId)
    .maybeSingle();
  if (!build) return null;
  const { data: builder } = await supabase
    .from("builders")
    .select("handle")
    .eq("user_id", build.builder_id)
    .maybeSingle();
  const photos = (build.photos ?? []) as BuildPhoto[];
  return {
    ...build,
    photos,
    documentCount: ((build.documents ?? []) as unknown[]).length,
    handle: builder?.handle ?? "a builder",
    heroUrl: heroImageUrl("build", build.id, photos[0]?.path),
  };
}

export const notifyBuildSubmitted = safely(
  "notifyBuildSubmitted",
  async (buildId: string, opts: { resubmitted: boolean; priorNote?: string | null; stamp: string }) => {
    const build = await loadBuild(buildId);
    if (!build) return;

    await send(
      TEAM_EMAIL,
      "admin-build",
      adminBuildSubmitted({
        buildTitle: build.title,
        handle: build.handle,
        resubmitted: opts.resubmitted,
        submittedAt: when(),
        photoCount: build.photos.length,
        docCount: build.documentCount,
        priorNote: opts.priorNote,
        heroUrl: build.heroUrl,
      }),
      `admin-build:${build.id}:${opts.stamp}`
    );
    await send(
      await emailForUser(build.builder_id),
      "build-received",
      buildReceived({ buildTitle: build.title, heroUrl: build.heroUrl }),
      `build-received:${build.id}:${opts.stamp}`
    );
  }
);

export const notifyBuildDecided = safely(
  "notifyBuildDecided",
  async (
    buildId: string,
    outcome: "live" | "needs_changes" | "denied",
    opts: { note?: string | null; stamp: string }
  ) => {
    const build = await loadBuild(buildId);
    if (!build) return;
    const to = await emailForUser(build.builder_id);
    const data = { buildTitle: build.title, heroUrl: build.heroUrl, note: opts.note };

    if (outcome === "live") {
      if (!build.slug) return;
      // One "approved and live" email per build, ever, even if it was first
      // published privately and made public later.
      await send(
        to,
        "build-approved-live",
        buildApprovedLive({
          ...data,
          pageUrl: `${SITE_URL}/builds/${build.slug}`,
          qrUrl: `${SITE_URL}/api/email-image/qr/${build.slug}`,
        }),
        `build-live:${build.id}`
      );
    } else if (outcome === "needs_changes") {
      await send(to, "build-needs-changes", buildNeedsChanges(data), `build-needs-changes:${build.id}:${opts.stamp}`);
    } else {
      await send(to, "build-denied", buildDenied(data), `build-denied:${build.id}`);
    }
  }
);

// ------------------------------------------------------------------ nudge

/** Called by the daily cron. Sends each draft's one nudge, once, ever. */
export async function sendDueNudges(): Promise<{ applications: number; builds: number }> {
  const supabase = getSupabaseAdmin();
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const newest = new Date(now - 7 * DAY).toISOString();
  // Don't dig up long-abandoned drafts: only the 7-21 day window.
  const oldest = new Date(now - 21 * DAY).toISOString();
  let applications = 0;
  let builds = 0;

  const { data: apps } = await supabase
    .from("applications")
    .select("id, user_id")
    .eq("status", "draft")
    .lte("updated_at", newest)
    .gte("updated_at", oldest);
  for (const app of apps ?? []) {
    const r = await sendNudge(app.user_id, "nudge-application", nudgeApplication(), `nudge-application:${app.id}`);
    if (r) applications++;
  }

  const { data: drafts } = await supabase
    .from("builds")
    .select("id, builder_id, title, photos, make")
    .eq("status", "draft")
    .lte("updated_at", newest)
    .gte("updated_at", oldest);
  for (const b of drafts ?? []) {
    const photos = (b.photos ?? []) as BuildPhoto[];
    if (!b.make && photos.length === 0) continue; // an empty accidental draft
    const r = await sendNudge(
      b.builder_id,
      "nudge-build",
      nudgeBuild({ buildTitle: b.title, heroUrl: heroImageUrl("build", b.id, photos[0]?.path) }),
      `nudge-build:${b.id}`
    );
    if (r) builds++;
  }
  return { applications, builds };
}

async function sendNudge(userId: string, template: string, mail: RenderedEmail, key: string): Promise<boolean> {
  const to = await emailForUser(userId);
  if (!to) return false;
  const r = await sendEmail({ to, template, dedupeKey: key, ...mail });
  return r.ok && !r.skipped;
}
