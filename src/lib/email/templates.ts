import { SITE_URL } from "@/lib/siteUrl";
import { renderEmail, type EmailBlock } from "./layout";

/**
 * The 11 notification emails, written to the "Motori.us Notification Emails"
 * doc. Rules baked in: action first, context second; every email links to the
 * site (people sign in there); no VINs anywhere; hero photo on every email
 * about a specific build; sign-off "The motori.us team" on emails to
 * Applicants and Builders.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export const ADMIN_LINKS = {
  applications: `${SITE_URL}/admin?tab=applications`,
  builds: `${SITE_URL}/admin?tab=builds`,
};

// ---------------------------------------------------------------- to team@

export interface AdminApplicationData {
  handle: string;
  resubmitted: boolean;
  submittedAt: string; // preformatted, e.g. "Oct 12, 4:10 PM"
  photoCount: number;
  priorNote?: string | null;
  heroUrl?: string | null;
  nominatedBy?: string | null; // handle of the Builder who sent the nomination link
}

export function adminApplicationSubmitted(d: AdminApplicationData): RenderedEmail {
  const blocks: EmailBlock[] = [
    {
      type: "p",
      text: `${d.resubmitted ? "Resubmitted" : "Submitted"} ${d.submittedAt}. ${d.photoCount} ${d.photoCount === 1 ? "photo" : "photos"}, desired handle ${d.handle}.`,
    },
  ];
  if (d.nominatedBy) blocks.unshift({ type: "p", text: `Nominated by ${d.nominatedBy}.` });
  if (d.resubmitted && d.priorNote) {
    blocks.push({ type: "note", label: "Your earlier note", text: d.priorNote });
  }
  return {
    subject: d.resubmitted ? `Application resubmitted: ${d.handle}` : `New application: ${d.handle}`,
    ...renderEmail({
      preheader: `${d.handle} is waiting for review.`,
      lead: `Review ${d.handle}’s application.`,
      heroUrl: d.heroUrl,
      buttons: [{ label: "Review application", url: ADMIN_LINKS.applications }],
      blocks,
      footerNote: "Sent to team@motori.us.",
    }),
  };
}

export interface AdminBuildData {
  buildTitle: string;
  handle: string;
  resubmitted: boolean;
  submittedAt: string;
  photoCount: number;
  docCount: number;
  priorNote?: string | null;
  heroUrl?: string | null;
}

export function adminBuildSubmitted(d: AdminBuildData): RenderedEmail {
  const blocks: EmailBlock[] = [
    {
      type: "p",
      text: `From ${d.handle}, ${d.resubmitted ? "resubmitted" : "submitted"} ${d.submittedAt}. ${d.photoCount} ${d.photoCount === 1 ? "photo" : "photos"}, ${d.docCount} ${d.docCount === 1 ? "PDF" : "PDFs"}.`,
    },
  ];
  if (d.resubmitted && d.priorNote) {
    blocks.push({ type: "note", label: "Your earlier note", text: d.priorNote });
  }
  return {
    subject: d.resubmitted ? `Build resubmitted: ${d.buildTitle}` : `New build: ${d.buildTitle} by ${d.handle}`,
    ...renderEmail({
      preheader: `${d.buildTitle} is waiting for review.`,
      lead: `Review ${d.buildTitle}.`,
      heroUrl: d.heroUrl,
      buttons: [{ label: "Review build", url: ADMIN_LINKS.builds }],
      blocks,
      footerNote: "Sent to team@motori.us.",
    }),
  };
}

// ------------------------------------------------------- application emails

export interface ApplicationEmailData {
  handle: string;
  note?: string | null;
}

export function applicationReceived(): RenderedEmail {
  return {
    subject: "Got it. We’re reviewing your application.",
    ...renderEmail({
      preheader: "You’ll hear from us within 24 hours.",
      lead: "You’re in the queue. Nothing to do right now.",
      buttons: [{ label: "View your application", url: `${SITE_URL}/apply` }],
      blocks: [
        {
          type: "p",
          text: "We review every application by hand, and you’ll hear from us within 24 hours. We keep motori.us select, so each one gets real attention.",
        },
      ],
      signOff: true,
    }),
  };
}

export function applicationApproved(d: ApplicationEmailData): RenderedEmail {
  return {
    subject: "You’re in. Welcome to motori.us.",
    ...renderEmail({
      preheader: "Your Builder account is ready. Start your first build.",
      lead: "Start your first build.",
      buttons: [{ label: "Open your Builder dashboard", url: `${SITE_URL}/builder` }],
      blocks: [
        {
          type: "p",
          text: `Congratulations, ${d.handle}. You’re one of a select group of early builders, and we’re glad you’re here.`,
        },
        { type: "p", text: "To submit a build, you need three things:" },
        {
          type: "ol",
          items: [
            "Two sentences describing your build’s theme.",
            "High-quality photos.",
            "Build documentation as PDFs.",
          ],
        },
        {
          type: "p",
          text: "Upload those and we draft the build page for you. You review it before anything goes public.",
        },
      ],
      signOff: true,
    }),
  };
}

export function applicationNeedsChanges(d: ApplicationEmailData): RenderedEmail {
  const note = (d.note ?? "").trim();
  return {
    subject: "One quick fix to finish your application",
    ...renderEmail({
      preheader: "Make one change and resubmit.",
      lead: note ? `Almost there. ${note}` : "Almost there. One quick change and you’re set.",
      buttons: [{ label: "Update your application", url: `${SITE_URL}/apply` }],
      blocks: [
        {
          type: "p",
          text: "We like what we’re seeing and want to get you over the line. Make the change and resubmit, and we’ll review it again within 24 hours.",
        },
      ],
      signOff: true,
    }),
  };
}

export function applicationDenied(d: ApplicationEmailData): RenderedEmail {
  const note = (d.note ?? "").trim();
  const blocks: EmailBlock[] = [
    {
      type: "p",
      text: "We keep motori.us to a small, select group of builders at this time, and this one isn’t a fit.",
    },
  ];
  if (note) blocks.push({ type: "note", label: "A note from us", text: note });
  blocks.push({ type: "p", text: "Thanks for applying. Questions? Reply to this email." });
  return {
    subject: "Your motori.us application",
    ...renderEmail({
      preheader: "An update on your application.",
      lead: "We’re not able to approve your application.",
      blocks,
      signOff: true,
    }),
  };
}

// ------------------------------------------------------------ build emails

export interface BuildEmailData {
  buildTitle: string;
  heroUrl?: string | null;
  note?: string | null;
}

export function buildReceived(d: BuildEmailData): RenderedEmail {
  return {
    subject: `Build received: ${d.buildTitle}`,
    ...renderEmail({
      preheader: "We’ll review it within 24 hours.",
      lead: "We have it. Nothing to do right now.",
      heroUrl: d.heroUrl,
      buttons: [{ label: "View your build", url: `${SITE_URL}/builder` }],
      blocks: [
        {
          type: "p",
          text: `We’ll review ${d.buildTitle} within 24 hours and email you the result. Once we approve it, we publish it right away. You can preview the page after every draft.`,
        },
      ],
      signOff: true,
    }),
  };
}

export interface BuildLiveData extends BuildEmailData {
  pageUrl: string;
  qrUrl: string;
}

export function buildApprovedLive(d: BuildLiveData): RenderedEmail {
  return {
    subject: `${d.buildTitle} is live`,
    ...renderEmail({
      preheader: "Approved and published. Share it.",
      lead: "Share it. Your page is live.",
      heroUrl: d.heroUrl,
      buttons: [
        { label: "View your live page", url: d.pageUrl },
        { label: "Open your share kit", url: `${SITE_URL}/builder` },
      ],
      blocks: [
        {
          type: "p",
          text: `Congratulations. ${d.buildTitle} made the cut and is public at ${d.pageUrl}. From your dashboard you can:`,
        },
        {
          type: "ul",
          items: [
            "Preview the page after every draft, and request edits (photo order and text).",
            "Start your next build.",
          ],
        },
        {
          type: "p",
          text: "Share links sit in your share kit: copy link, plus Instagram, Facebook and TikTok through your phone’s share sheet.",
        },
        {
          type: "image",
          url: d.qrUrl,
          alt: `QR code for ${d.buildTitle}`,
          caption: "Your QR code. Put it on a card, a windshield sheet or a phone at your next meet, and anyone who scans it lands on your build.",
        },
        { type: "p", text: "Got another build in the garage? Submit it, and we’ll draft that page too." },
      ],
      signOff: true,
    }),
  };
}

export function buildNeedsChanges(d: BuildEmailData): RenderedEmail {
  const note = (d.note ?? "").trim();
  return {
    subject: `${d.buildTitle}: one step to go`,
    ...renderEmail({
      preheader: "Make the change and resubmit.",
      lead: note ? `Fix this and resubmit: ${note}` : "One change, then resubmit.",
      heroUrl: d.heroUrl,
      buttons: [{ label: "Update your build", url: `${SITE_URL}/builder` }],
      blocks: [
        {
          type: "p",
          text: "Your draft is saved, so you won’t lose anything. Better photos or PDFs usually do it. Resubmit and we’ll review again within 24 hours.",
        },
      ],
      signOff: true,
    }),
  };
}

export function buildDenied(d: BuildEmailData): RenderedEmail {
  const note = (d.note ?? "").trim();
  const blocks: EmailBlock[] = [
    {
      type: "p",
      text: "We keep the platform select, and this build isn’t a fit. Your Builder account stays active.",
    },
  ];
  if (note) blocks.splice(1, 0, { type: "note", label: "A note from us", text: note });
  blocks.push({ type: "p", text: "Questions? Reply to this email." });
  return {
    subject: `Update on ${d.buildTitle}`,
    ...renderEmail({
      preheader: "An update on your build.",
      lead: `We’re not able to accept ${d.buildTitle} on motori.us.`,
      heroUrl: d.heroUrl,
      blocks,
      signOff: true,
    }),
  };
}

// ------------------------------------------------------------------ nudge

export function nudgeBuild(d: BuildEmailData): RenderedEmail {
  return {
    subject: `Your ${d.buildTitle} draft is waiting`,
    ...renderEmail({
      preheader: "It takes a few minutes to finish.",
      lead: "Finish your submission. It takes a few minutes.",
      heroUrl: d.heroUrl,
      buttons: [{ label: "Continue where you left off", url: `${SITE_URL}/builder` }],
      blocks: [
        {
          type: "p",
          text: "You saved this a week ago. Add what’s missing, submit it, and we’ll do the rest. This is the only reminder we’ll send.",
        },
      ],
      signOff: true,
    }),
  };
}

export function nudgeApplication(): RenderedEmail {
  return {
    subject: "Your motori.us application is waiting",
    ...renderEmail({
      preheader: "It takes a few minutes to finish.",
      lead: "Finish your submission. It takes a few minutes.",
      buttons: [{ label: "Continue where you left off", url: `${SITE_URL}/apply` }],
      blocks: [
        {
          type: "p",
          text: "You saved this a week ago. Add what’s missing, submit it, and we’ll do the rest. This is the only reminder we’ll send.",
        },
      ],
      signOff: true,
    }),
  };
}

// ------------------------------------------------- following + legal notices

export interface MarketingFooter {
  reason: string;
  unsubscribeUrl: string;
  postalAddress: string;
}

/** Double opt-in: sent when someone asks to follow. Nothing else is sent until they confirm. */
export function subscribeConfirm(d: { scopeLabel: string; confirmUrl: string }): RenderedEmail {
  return {
    subject: `Confirm: follow ${d.scopeLabel} on motori.us`,
    ...renderEmail({
      preheader: "One tap to confirm. If this wasn't you, ignore this email.",
      lead: "Confirm your subscription.",
      buttons: [{ label: "Yes, send me updates", url: d.confirmUrl }],
      blocks: [
        { type: "p", text: `You asked to follow ${d.scopeLabel} on motori.us. Confirm and we’ll email you when there’s something new.` },
        { type: "p", text: "If this wasn’t you, ignore this email. You won’t hear from us again." },
      ],
      footerNote: "motori.us: one open record for every build.",
    }),
  };
}

export function newBuildAnnouncement(d: {
  buildTitle: string;
  builderName: string;
  blurb?: string | null;
  heroUrl?: string | null;
  pageUrl: string;
  marketing: MarketingFooter;
}): RenderedEmail {
  const blocks: EmailBlock[] = [];
  if (d.blurb) blocks.push({ type: "p", text: d.blurb });
  blocks.push({ type: "p", text: `Documented by ${d.builderName} on motori.us.` });
  return {
    subject: `New on motori.us: ${d.buildTitle}`,
    ...renderEmail({
      preheader: `${d.buildTitle}, documented by ${d.builderName}.`,
      lead: `${d.buildTitle} is live.`,
      heroUrl: d.heroUrl,
      buttons: [{ label: "See the build", url: d.pageUrl }],
      blocks,
      marketing: d.marketing,
    }),
  };
}

/** Admin-written update to followers. Paragraphs are plain text, separated by blank lines. */
export function broadcastEmail(d: {
  subject: string;
  lead: string;
  paragraphs: string[];
  buttonLabel?: string | null;
  buttonUrl?: string | null;
  heroUrl?: string | null;
  marketing: MarketingFooter;
}): RenderedEmail {
  return {
    subject: d.subject,
    ...renderEmail({
      preheader: d.paragraphs[0]?.slice(0, 110) ?? d.lead,
      lead: d.lead,
      heroUrl: d.heroUrl,
      buttons: d.buttonLabel && d.buttonUrl ? [{ label: d.buttonLabel, url: d.buttonUrl }] : [],
      blocks: d.paragraphs.map((text) => ({ type: "p" as const, text })),
      signOff: true,
      marketing: d.marketing,
    }),
  };
}

/** Service notice to account holders when a legal document changes. */
export function termsUpdated(d: {
  items: { title: string; version: string; summary: string; url: string }[];
  actionUrl: string;
}): RenderedEmail {
  return {
    subject: "We’ve updated our terms",
    ...renderEmail({
      preheader: "Please review and accept the latest version.",
      lead: "We’ve updated our terms.",
      buttons: [{ label: "Review and accept", url: d.actionUrl }],
      blocks: [
        { type: "p", text: "Here is what changed:" },
        { type: "ul", items: d.items.map((i) => `${i.title} (version ${i.version}): ${i.summary}`) },
        {
          type: "p",
          text: "You can read the full text on the site. We’ll ask you to accept the new versions the next time you use your Builder account. Browsing the site doesn’t change.",
        },
      ],
      signOff: true,
    }),
  };
}

// ---------------------------------------------------------------- registry

export interface TemplateDef {
  id: string;
  label: string;
  audience: "team" | "applicant" | "builder" | "subscriber";
  render: (hero: string | null) => RenderedEmail;
}

/** Sample data for the admin preview page and test sends. */
export const TEMPLATE_REGISTRY: TemplateDef[] = [
  {
    id: "admin-application",
    label: "1. New application (to team@)",
    audience: "team",
    render: (hero) =>
      adminApplicationSubmitted({
        handle: "sample-garage",
        resubmitted: false,
        submittedAt: "Oct 12, 4:10 PM",
        photoCount: 3,
        heroUrl: hero,
        nominatedBy: "mahlzeit-motorsport",
      }),
  },
  {
    id: "admin-application-resubmitted",
    label: "1b. Application resubmitted (to team@)",
    audience: "team",
    render: (hero) =>
      adminApplicationSubmitted({
        handle: "sample-garage",
        resubmitted: true,
        submittedAt: "Oct 13, 9:02 AM",
        photoCount: 3,
        priorNote: "Add one more photo of the engine bay.",
        heroUrl: hero,
      }),
  },
  {
    id: "admin-build",
    label: "2. New build (to team@)",
    audience: "team",
    render: (hero) =>
      adminBuildSubmitted({
        buildTitle: "1973 BMW 3.0 CSL",
        handle: "sample-garage",
        resubmitted: false,
        submittedAt: "Oct 12, 4:10 PM",
        photoCount: 24,
        docCount: 6,
        heroUrl: hero,
      }),
  },
  {
    id: "admin-build-resubmitted",
    label: "2b. Build resubmitted (to team@)",
    audience: "team",
    render: (hero) =>
      adminBuildSubmitted({
        buildTitle: "1973 BMW 3.0 CSL",
        handle: "sample-garage",
        resubmitted: true,
        submittedAt: "Oct 13, 9:02 AM",
        photoCount: 26,
        docCount: 7,
        priorNote: "The engine bay photos are too dark.",
        heroUrl: hero,
      }),
  },
  { id: "application-received", label: "3. Application received", audience: "applicant", render: () => applicationReceived() },
  {
    id: "application-approved",
    label: "4. Application approved",
    audience: "applicant",
    render: () => applicationApproved({ handle: "sample-garage" }),
  },
  {
    id: "application-needs-changes",
    label: "5. Application needs changes",
    audience: "applicant",
    render: () => applicationNeedsChanges({ handle: "sample-garage", note: "Add one more photo of the car from the front." }),
  },
  {
    id: "application-denied",
    label: "6. Application denied",
    audience: "applicant",
    render: () => applicationDenied({ handle: "sample-garage", note: "We’re focused on documented restomods right now." }),
  },
  {
    id: "build-received",
    label: "7. Build received",
    audience: "builder",
    render: (hero) => buildReceived({ buildTitle: "1973 BMW 3.0 CSL", heroUrl: hero }),
  },
  {
    id: "build-approved-live",
    label: "8. Build approved and live",
    audience: "builder",
    render: (hero) =>
      buildApprovedLive({
        buildTitle: "1973 BMW 3.0 CSL",
        heroUrl: hero,
        pageUrl: `${SITE_URL}/builds/sample`,
        qrUrl: `${SITE_URL}/api/email-image/qr/sample`,
      }),
  },
  {
    id: "build-needs-changes",
    label: "9. Build needs changes",
    audience: "builder",
    render: (hero) =>
      buildNeedsChanges({
        buildTitle: "1973 BMW 3.0 CSL",
        heroUrl: hero,
        note: "Swap the dark engine bay photos for brighter ones.",
      }),
  },
  {
    id: "build-denied",
    label: "10. Build denied",
    audience: "builder",
    render: (hero) =>
      buildDenied({ buildTitle: "1973 BMW 3.0 CSL", heroUrl: hero, note: "The documentation doesn’t support the build claims." }),
  },
  {
    id: "nudge-build",
    label: "11. Gentle nudge (build)",
    audience: "builder",
    render: (hero) => nudgeBuild({ buildTitle: "1973 BMW 3.0 CSL", heroUrl: hero }),
  },
  { id: "nudge-application", label: "11b. Gentle nudge (application)", audience: "applicant", render: () => nudgeApplication() },
  {
    id: "subscribe-confirm",
    label: "12. Confirm subscription (to a follower)",
    audience: "subscriber",
    render: () => subscribeConfirm({ scopeLabel: "new builds", confirmUrl: `${SITE_URL}/subscribe/confirm?token=sample` }),
  },
  {
    id: "new-build-announcement",
    label: "13. New build announcement (to followers)",
    audience: "subscriber",
    render: (hero) =>
      newBuildAnnouncement({
        buildTitle: "1973 BMW 3.0 CSL",
        builderName: "Sample Garage",
        blurb: "A ground-up restoration documented step by step.",
        heroUrl: hero,
        pageUrl: `${SITE_URL}/builds/sample`,
        marketing: {
          reason: "You’re getting this because you follow new builds on motori.us.",
          unsubscribeUrl: `${SITE_URL}/unsubscribe?token=sample`,
          postalAddress: "Sample postal address",
        },
      }),
  },
  {
    id: "broadcast",
    label: "14. Newsletter / update (to followers)",
    audience: "subscriber",
    render: (hero) =>
      broadcastEmail({
        subject: "What’s new on motori.us",
        lead: "A few new builds this month.",
        paragraphs: ["Here is a short note written by the motori.us team.", "A second paragraph with more detail."],
        buttonLabel: "Visit motori.us",
        buttonUrl: SITE_URL,
        heroUrl: hero,
        marketing: {
          reason: "You’re getting this because you follow motori.us.",
          unsubscribeUrl: `${SITE_URL}/unsubscribe?token=sample`,
          postalAddress: "Sample postal address",
        },
      }),
  },
  {
    id: "terms-updated",
    label: "15. Terms updated (to account holders)",
    audience: "builder",
    render: () =>
      termsUpdated({
        items: [{ title: "Builder Terms", version: "2027-01-01", summary: "Adds terms for optional on-chain records.", url: `${SITE_URL}/builder-terms` }],
        actionUrl: `${SITE_URL}/builder`,
      }),
  },
];
