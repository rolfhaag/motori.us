import { createHash } from "crypto";
import { OPERATOR } from "./config";

/**
 * The legal documents, version by version.
 *
 * To change one: edit its text, set a new `version` (a date string) and write a
 * plain-English `changeSummary`. On the next request the new version is stored
 * (the old one stays on file forever), everyone is asked to accept it before
 * their next Builder action, and Admin > Legal can email the change notice.
 * Never edit the text of a version that has already shipped without bumping it.
 */

export type LegalDocType = "terms" | "builder_terms" | "privacy";

export interface LegalDoc {
  type: LegalDocType;
  version: string;
  title: string;
  /** URL path of the current version. */
  path: string;
  effectiveDate: string; // YYYY-MM-DD
  changeSummary: string;
  markdown: string;
}

const O = OPERATOR;

const TERMS = `
These Terms of Use apply to everyone who visits or uses motori.us. By browsing the site, creating an account or using any feature, you agree to them. If you don't agree, please don't use the site.

## 1. Who we are and what motori.us is

motori.us ("**motori.us**", "**we**", "**us**") is operated by ${O.name}, ${O.description}. motori.us is a curated place where Builders publish documented records of car builds: photos, documents and written descriptions that Builders provide.

## 2. What motori.us is not

motori.us is a documentation platform. We are not a car dealer, broker, auctioneer, appraiser, inspector, lender, escrow agent or title or registration authority. Nothing on the site is an offer to sell, an appraisal, a valuation, an inspection, a guarantee, or legal, financial, tax or investment advice. No sale takes place through motori.us, and a page on motori.us is not a vehicle title, registration or proof of ownership of any car.

## 3. Content comes from Builders and is not verified by us

Every Build page, photo, document, description, specification, history, inspection result, price or claim on motori.us is provided by the Builder, shop or other contributor who submitted it.

- We do **not** verify it, inspect the car, or check that it is complete, accurate, current or lawful.
- We are **not** responsible for what Builders or shops say, for the condition, history, authenticity or value of any car, or for any decision you make based on a page.
- Being accepted onto motori.us, or having a page published, is our editorial choice about what to feature. It is **not** a verification, certification or endorsement of the Builder, the car or the content.
- If you are considering buying, selling, financing or insuring a car, do your own research, get an independent inspection and check the car's title and history yourself. Don't rely on motori.us.
- Some pages carry data from documents the Builder uploaded (for example an inspection report). Those are the Builder's documents, not ours.

${O.name} also builds cars and is itself a Builder on motori.us. Its pages receive no special verification, and the same terms apply to them as to every other Builder.

## 4. AI-assisted pages

Builders can use AI tools to help draft their Build pages from the photos, documents and notes they provide. A Builder reviews and approves their page before it is published and is responsible for it as their own statement. AI-assisted text can contain mistakes; treat it like any other Builder-provided content.

## 5. Accounts

You sign in with your email through our authentication provider. You must be at least 18. Keep your sign-in secure; you are responsible for activity on your account. We may suspend or remove accounts or content at our discretion, including to protect the site or other people.

## 6. Acceptable use

Don't misuse the site: no unlawful, deceptive or infringing content; no impersonation or fake records; no scraping that harms the site, probing for vulnerabilities, or interfering with others' use; and no attempt to access private builds, other people's accounts or data you aren't entitled to.

## 7. Content and licenses

The motori.us name, design and software belong to us or our licensors. Builders keep ownership of what they submit and grant us the license described in the Builder Terms. You may view and share links to public pages; please don't copy Builder content in bulk or present it as your own.

## 8. Following and email updates

You can ask to follow motori.us, a Builder or a Build and receive email updates. That is optional, separate from these Terms, confirmed by a link we email you, and you can unsubscribe at any time from any email. See the [Privacy Policy](/privacy) for how we handle your email address.

## 9. Features we may add, including on-chain records

We may introduce optional paid features, including features that record or anchor a Build's information on a public blockchain. Such features will come with additional terms that you must accept before you use them. Records written to a public blockchain are generally permanent and public, and any such record would show only what the feature's terms describe. Nothing on the site today is a blockchain record, token or digital asset.

## 10. Third-party links and services

The site may link to or rely on third-party services (for example sign-in, hosting, email and social platforms). We don't control them and are not responsible for their content or practices.

## 11. Disclaimers

motori.us and everything on it are provided "**as is**" and "**as available**", without warranties of any kind, express or implied, including accuracy, completeness, fitness for a particular purpose, title and non-infringement. We don't promise the site will be uninterrupted, error-free or secure.

## 12. Limitation of liability

To the fullest extent the law allows, ${O.name}, its members, managers, employees and contractors are not liable for any indirect, incidental, special, consequential or punitive damages, or for lost profits, lost data or loss of value of any vehicle, arising from your use of or reliance on motori.us or any content on it, including Builder-provided content. Our total liability for any claim relating to motori.us is limited to the greater of US$100 and the amount you paid us in the 12 months before the claim. Some places don't allow these limits, so they apply only as far as the law permits.

## 13. Indemnity

If you submit content or use motori.us in breach of these Terms or the law, you agree to defend and indemnify us against claims, damages and costs arising from that.

## 14. Changes to these Terms

We may update these Terms. For material changes we will email account holders and ask you to accept the new version before you continue using Builder features. The version you accepted and when is kept on file. Older versions remain available on request. If you keep using the site after a change takes effect, you accept it.

## 15. Ending your use

You can stop using motori.us at any time. We can suspend or end access at any time. Sections that by their nature should survive (including 3, 11, 12, 13 and 17) do.

## 16. Copyright complaints

If you believe content on motori.us infringes your copyright, email ${O.email} with the page link, what you believe is infringed, your contact details and a statement made in good faith that the use is unauthorized. We will review it and may remove the content.

## 17. Governing law

These Terms are governed by the laws of ${O.governingLaw}, without regard to conflict-of-law rules. Courts located in ${O.venue} have exclusive jurisdiction, except that either of us may seek urgent relief in any competent court.

## 18. Contact

${O.name}, ${O.email}.
`.trim();

const BUILDER_TERMS = `
These Builder Terms apply to you if you apply to be, or are, a Builder on motori.us. They add to the [Terms of Use](/terms). If they conflict, these Builder Terms control for Builders.

## 1. Applying and being accepted

motori.us is curated. Applying doesn't entitle you to be accepted, and we may decline, hold, hide, edit, unpublish or remove any application, Builder or Build at our discretion and without having to explain.

## 2. You are responsible for what you publish

You are solely responsible for everything you submit or publish: photos, documents, descriptions, specifications, history, inspection results, claims about ownership or condition, and any text produced by AI tools from your material. By submitting you promise that:

- it is accurate, complete and not misleading, to the best of your knowledge;
- you own it or have the right to submit and publish it, including photos and documents made by others (shops, inspectors, photographers);
- it doesn't infringe anyone's rights, break any law, or include personal data about other people beyond what is necessary (for example, don't include home addresses, and don't publish license plates you don't want public);
- you are entitled to describe the car and its history, including that the VIN you give us belongs to the car;
- you have read and approved the page as published, including any AI-assisted draft. A draft isn't ours: once you approve it, it is your statement.

## 3. We don't verify and we aren't responsible for your content

We don't inspect cars or check Builder statements, and being accepted or published is not verification or endorsement (see Terms of Use section 3). You agree that we are not responsible for the accuracy, legality or completeness of your content or for any dispute between you and a buyer, seller, shop, owner or anyone else.

## 4. License to us

You keep ownership of your content. You grant ${O.name} a worldwide, non-exclusive, royalty-free license to host, store, copy, resize, process (including with AI tools to draft your page and to check or categorize photos and documents), display, adapt for formatting, and promote your content, your Builder name and your Builds on motori.us, in link previews, on social media and in marketing for motori.us, for as long as the content is published and for a reasonable period afterward for backups and records. Private uploads (such as full VINs and uploaded documents) are not published as such; see the [Privacy Policy](/privacy).

## 5. VINs and private material

VINs are masked for public viewers by default. Documents you upload are used to draft your page and are not offered for public download unless you tell us otherwise. Don't upload anything you aren't allowed to share with us.

## 6. Correcting, updating and removing

Keep your Builds accurate. Tell us promptly at ${O.email} about material errors, and update your page. We may correct, label, hide or remove content that we believe is inaccurate, unlawful, misleading or harmful. You can ask us to unpublish a Build; some copies (backups, previews, search engines, records already shared) may persist for a time.

## 7. Conduct and reviews

Follow the acceptable-use rules in the Terms of Use. Don't submit fake or staged records, don't misrepresent a car's condition, history or ownership, and don't use motori.us to deceive a buyer. We may suspend or remove you for any breach and may disclose information when the law requires.

## 8. ${O.name} is also a Builder

${O.name} operates motori.us and also publishes its own Builds. Its Builds are held to these same terms and receive no special verification. The operator's content is its own, and nothing on motori.us should be read as an endorsement of any particular car.

## 9. Fees and optional paid features

Applying and publishing are currently free. We may introduce paid or optional features (including on-chain records) later; those will have their own terms and fees, which you must accept before you use them. We will not charge you for anything without your agreement.

## 10. Indemnity and liability

You agree to defend and indemnify ${O.name} and its members, managers, employees and contractors against claims, damages and costs arising from your content, your breach of these terms, or your dealings with buyers, sellers or others. The disclaimers and limits in the Terms of Use (sections 11 and 12) apply to everything under these Builder Terms.

## 11. Ending

You can close your Builder account by emailing ${O.email}. We can end it at any time. Sections that should survive, do.

## 12. Changes

We may update these Builder Terms; we'll email you for material changes and ask you to accept the new version before you submit or publish again. Your acceptance of each version is recorded.
`.trim();

const PRIVACY = `
This Privacy Policy explains what ${O.name} ("**we**") collects through motori.us, why, who we share it with, and the choices you have. Questions or requests: ${O.email}.

## 1. What we collect

- **Account details.** Your email address and a sign-in identifier from our authentication provider (Privy). Privy also creates a wallet that is tied to your sign-in; we store its public address, never its private keys.
- **Application and Builder details.** Your chosen handle, description, social links, photos you upload, and anything you write in your application or Builder profile.
- **Build material.** Make, model, year, trim, VIN, your theme and notes, and the photos and documents you upload, along with the page we draft and publish from them.
- **Following and email.** If you follow motori.us, a Builder or a Build: your email address, what you follow, the wording you agreed to, when you confirmed and the IP address and browser type used to sign up.
- **Records of agreement.** Which version of our terms you accepted, when, and from which page, with your IP address and browser type, so we can show what was agreed.
- **Messages.** Emails you send to ${O.email} and copies of notifications we send you.
- **Usage data.** Page views and basic device and referrer information, collected with Vercel Web Analytics, which doesn't use advertising cookies.
- **Nominations.** If a Builder nominates you, we record that link and who sent it.

We don't collect payment card numbers on motori.us today. If we add paid features, the payment provider's own policy will govern payment details.

## 2. How we use it

- To run the site: sign you in, review applications and Builds, draft and publish Build pages.
- To send service emails: receipt and decision notices, review requests and reminders about your own application or Builds.
- To send updates you asked for (following), and the occasional newsletter to people who subscribed.
- To keep the site safe, prevent abuse and meet legal obligations.
- To improve the site, using aggregated usage data.

We don't sell your personal information and we don't share it for advertising.

## 3. What is public

Published Build pages and Builder pages are public: the Builder handle and description, the page content, photos and any documents data the Builder chose to include. VINs are masked for public viewers. Your email address is never shown publicly.

## 4. Who we share it with

We use service providers who process data for us, under their own terms:

- **Privy** for sign-in and wallets.
- **Supabase** for our database and file storage.
- **Vercel** for hosting and analytics.
- **Resend** to send email.
- **Anthropic** for the AI that helps draft Build pages: your photos, documents and notes are sent to it to produce the draft.
- **Google Workspace** for the team inbox, and **GoDaddy** for the domain.

We may also disclose information if the law requires it, to enforce our terms or protect people and the site, or in a business transfer.

## 5. Following and email choices

Following is optional and needs your confirmation by email. Every update email has an unsubscribe link that works immediately. Service emails about your own account or submissions are not marketing, so you can't unsubscribe from them while you have an active account or submission, but you can ask us to close your account.

## 6. Cookies and local storage

We use essential storage for sign-in and a few remembered settings (for example a nomination link you opened). We don't use advertising or cross-site tracking cookies. Our analytics doesn't set advertising cookies.

## 7. Retention

We keep account and Builder data while your account is active and afterward as needed for the purposes above and legal records. Records of agreements and email logs are kept to prove what was agreed and sent. You can ask us to delete your account and personal data; we may keep what the law or a legitimate dispute requires. Public pages and cached copies, previews and search results may take time to disappear.

## 8. Blockchain features

If we add features that record information on a public blockchain, we will tell you before you use them. Public blockchains are permanent and visible to everyone, so we won't put personal information such as your email address on a blockchain. Wallet addresses and the record data described in those features' terms may be public by nature.

## 9. Your rights

Depending on where you live (for example California under the CCPA/CPRA, or the EU and UK) you may have the right to know what we hold about you, get a copy, correct it, delete it, object to or limit some uses, and not be discriminated against for using these rights. Email ${O.email} and we will respond within the time the law allows. We may need to verify your identity. We don't sell or share personal information as those terms are defined in California law.

## 10. International users

We are based in the United States, and data is processed in the United States and wherever our providers operate. By using the site you understand your information goes there.

## 11. Children

motori.us is for people 18 and over. We don't knowingly collect information from children. If you think we have, tell us and we'll delete it.

## 12. Security

We use reasonable safeguards, including access controls, private storage for uploads and signed, expiring links for private files. No system is perfectly secure.

## 13. Changes

If we change this policy in a way that matters, we'll update the date and email account holders. The current version is always at /privacy and earlier versions are kept on file.

## 14. Contact

${O.name}, ${O.email}.
`.trim();

export const LEGAL_DOCS: Record<LegalDocType, LegalDoc> = {
  terms: {
    type: "terms",
    version: "2026-10-19",
    title: "Terms of Use",
    path: "/terms",
    effectiveDate: "2026-10-19",
    changeSummary: "First published version of the Terms of Use.",
    markdown: TERMS,
  },
  builder_terms: {
    type: "builder_terms",
    version: "2026-10-19",
    title: "Builder Terms",
    path: "/builder-terms",
    effectiveDate: "2026-10-19",
    changeSummary: "First published version of the Builder Terms.",
    markdown: BUILDER_TERMS,
  },
  privacy: {
    type: "privacy",
    version: "2026-10-19",
    title: "Privacy Policy",
    path: "/privacy",
    effectiveDate: "2026-10-19",
    changeSummary: "First published version of the Privacy Policy.",
    markdown: PRIVACY,
  },
};

export const LEGAL_DOC_TYPES = Object.keys(LEGAL_DOCS) as LegalDocType[];

export function isLegalDocType(v: unknown): v is LegalDocType {
  return typeof v === "string" && (LEGAL_DOC_TYPES as string[]).includes(v);
}

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Minimal, safe Markdown for our own legal text: ## headings, paragraphs, - lists, **bold**, [links](/path). */
function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function inline(s: string) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((\/[^)\s]*|https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
}
export function renderLegalMarkdown(md: string): string {
  const out: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      out.push(`<ul>${list.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`);
      list = [];
    }
  };
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    if (line.startsWith("## ")) {
      flush();
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith("- ")) {
      list.push(line.slice(2));
    } else {
      flush();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  flush();
  return out.join("\n");
}
