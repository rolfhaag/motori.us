import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { SITE_URL } from "@/lib/siteUrl";
import { sendEmail } from "./send";
import { spotterInvite, spotterUpdate } from "./templates";
import { builderName } from "@/lib/names";

/** Spotter emails. Each one never throws, so callers can run it after the response. */

async function spotterEmail(spotterId: string): Promise<{ email: string; name: string } | null> {
  const supabase = getSupabaseAdmin();
  const { data: sp } = await supabase
    .from("spotters")
    .select("user_id, display_name, status")
    .eq("id", spotterId)
    .maybeSingle();
  if (!sp || sp.status !== "active") return null;
  const { data: u } = await supabase.from("users").select("email, banned").eq("id", sp.user_id).maybeSingle();
  if (!u?.email || u.banned) return null;
  return { email: u.email, name: sp.display_name };
}

export async function sendSpotterInviteEmail(to: string, name: string | null, url: string, inviteId: string) {
  const mail = spotterInvite({ name, url });
  return sendEmail({ to, template: "spotter-invite", dedupeKey: `spotter-invite:${inviteId}`, ...mail });
}

/** The person a Spotter nominated was accepted as a Builder. */
export async function notifySpotterBuilderApproved(applicationId: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: app } = await supabase
      .from("applications")
      .select("id, handle, display_name, spotter_id")
      .eq("id", applicationId)
      .maybeSingle();
    if (!app?.spotter_id) return;
    const to = await spotterEmail(app.spotter_id);
    if (!to) return;
    const shown = app.display_name || app.handle;
    const mail = spotterUpdate({
      lead: "A car you spotted was accepted.",
      body: `${shown} is now a Builder on motori.us. You’re credited as the Spotter who brought them in. Once their first build goes live, it can carry your Spotter credit too.`,
      url: `${SITE_URL}/spotter`,
      buttonLabel: "See your Spotter page",
    });
    await sendEmail({ to: to.email, template: "spotter-update", dedupeKey: `spotter-approved:${app.id}`, ...mail });
  } catch (err) {
    console.error("[email] notifySpotterBuilderApproved failed:", err);
  }
}

/** A build carrying a Spotter's credit went live. */
export async function notifySpotterBuildLive(buildId: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: build } = await supabase
      .from("builds")
      .select("id, title, slug, status, visibility, hidden, builder_id, spotted_by_spotter_id")
      .eq("id", buildId)
      .maybeSingle();
    if (!build?.spotted_by_spotter_id || build.status !== "published" || build.visibility === "private" || build.hidden || !build.slug) {
      return;
    }
    const to = await spotterEmail(build.spotted_by_spotter_id);
    if (!to) return;
    const { data: builder } = await supabase.from("builders").select("handle").eq("user_id", build.builder_id).maybeSingle();
    const by = builder ? await builderName(builder.handle) : "A Builder";
    const mail = spotterUpdate({
      lead: "A car you spotted is now live.",
      body: `${by}’s ${build.title} is live on motori.us, with your Spotter credit.`,
      url: `${SITE_URL}/builds/${build.slug}/`,
      buttonLabel: "See the build",
    });
    await sendEmail({ to: to.email, template: "spotter-update", dedupeKey: `spotter-live:${build.id}`, ...mail });
  } catch (err) {
    console.error("[email] notifySpotterBuildLive failed:", err);
  }
}
