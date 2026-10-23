import { SITE_URL } from "@/lib/siteUrl";

/**
 * Shared email layout: table-based, inline CSS, so it holds up in Gmail,
 * Apple Mail and Outlook. Light card on a light page; the dark accent stripe
 * and wordmark match the site. No VINs ever go through here.
 */

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailButton {
  label: string;
  url: string;
}

export interface EmailParts {
  /** Hidden inbox preview text. */
  preheader: string;
  /** The bold "do this" line, first thing after the hero image. */
  lead: string;
  /** Hero photo URL (public, signed); omitted when there is none. */
  heroUrl?: string | null;
  /** One or more buttons; the first is the primary one. */
  buttons?: EmailButton[];
  /** Body blocks, in order. */
  blocks?: EmailBlock[];
  /** Show the "The motori.us team" sign-off (not on team@ notifications). */
  signOff?: boolean;
  /** Footer line under the sign-off; defaults to the standard footer. */
  footerNote?: string;
  /**
   * For update/newsletter emails: why they got it, a working unsubscribe link
   * and a postal address (all required for commercial email).
   */
  marketing?: { reason: string; unsubscribeUrl: string; postalAddress: string };
}

export type EmailBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "note"; label: string; text: string }
  | { type: "image"; url: string; alt: string; caption?: string };

const INK = "#14161a";
const MUTED = "#5b616b";
const LINE = "#e4e6ea";
const ACCENT = "#b3202a";
const PAGE = "#f3f4f6";

function renderBlock(b: EmailBlock): string {
  switch (b.type) {
    case "p":
      return `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${INK};">${esc(b.text)}</p>`;
    case "ul":
    case "ol": {
      const tag = b.type;
      const items = b.items
        .map((i) => `<li style="margin:0 0 8px;">${esc(i)}</li>`)
        .join("");
      return `<${tag} style="margin:0 0 16px;padding-left:22px;font-size:16px;line-height:1.55;color:${INK};">${items}</${tag}>`;
    }
    case "note":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="border-left:3px solid ${ACCENT};background:#faf6f6;padding:12px 16px;font-size:15px;line-height:1.55;color:${INK};"><div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${MUTED};margin:0 0 4px;">${esc(b.label)}</div>${esc(b.text).replace(/\n/g, "<br>")}</td></tr></table>`;
    case "image":
      return `<p style="margin:0 0 6px;text-align:center;"><img src="${esc(b.url)}" alt="${esc(b.alt)}" width="260" style="display:block;margin:0 auto;border:0;max-width:100%;height:auto;"></p>${
        b.caption
          ? `<p style="margin:0 0 20px;text-align:center;font-size:13px;color:${MUTED};">${esc(b.caption)}</p>`
          : `<div style="height:14px;line-height:14px;">&nbsp;</div>`
      }`;
  }
}

function renderButton(btn: EmailButton, primary: boolean): string {
  const bg = primary ? INK : "#ffffff";
  const fg = primary ? "#ffffff" : INK;
  const border = primary ? INK : "#c9ccd2";
  // Bulletproof button: a padded table cell with a link, so Outlook keeps it.
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table;margin:0 8px 10px 0;"><tr><td style="background:${bg};border:1px solid ${border};border-radius:6px;"><a href="${esc(btn.url)}" style="display:inline-block;padding:13px 22px;font-size:16px;font-weight:600;color:${fg};text-decoration:none;">${esc(btn.label)}</a></td></tr></table>`;
}

export function renderEmail(parts: EmailParts): { html: string; text: string } {
  const buttons = parts.buttons ?? [];
  const blocks = parts.blocks ?? [];
  const footerNote = parts.footerNote ?? "motori.us: one open record for every build.";

  const hero = parts.heroUrl
    ? `<tr><td style="padding:0;"><img src="${esc(parts.heroUrl)}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>`
    : "";

  const buttonRow = buttons.length
    ? `<div style="margin:6px 0 4px;">${buttons.map((b, i) => renderButton(b, i === 0)).join("")}</div><p style="margin:0 0 22px;font-size:13px;line-height:1.5;color:${MUTED};word-break:break-all;">${buttons
        .map((b) => `${esc(b.label)}: <a href="${esc(b.url)}" style="color:${MUTED};">${esc(b.url)}</a>`)
        .join("<br>")}</p>`
    : "";

  const signOff = parts.signOff
    ? `<p style="margin:8px 0 0;font-size:16px;line-height:1.55;color:${INK};">The motori.us team</p>`
    : "";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>motori.us</title></head>
<body style="margin:0;padding:0;background:${PAGE};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(parts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${LINE};border-radius:8px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<tr><td style="height:5px;line-height:5px;font-size:0;background:${ACCENT};">&nbsp;</td></tr>
<tr><td style="padding:20px 28px 16px;font-size:20px;font-weight:700;letter-spacing:.02em;color:${INK};"><a href="${SITE_URL}" style="color:${INK};text-decoration:none;">motori<span style="color:${ACCENT};">.</span>us</a></td></tr>
${hero}
<tr><td style="padding:24px 28px 8px;">
<p style="margin:0 0 18px;font-size:20px;line-height:1.35;font-weight:700;color:${INK};">${esc(parts.lead)}</p>
${buttonRow}
${blocks.map(renderBlock).join("\n")}
${signOff}
</td></tr>
<tr><td style="padding:18px 28px 24px;border-top:1px solid ${LINE};font-size:13px;line-height:1.5;color:${MUTED};">${esc(footerNote)}<br>Reply to this email to reach us.${
    parts.marketing
      ? `<br><br>${esc(parts.marketing.reason)} <a href="${esc(parts.marketing.unsubscribeUrl)}" style="color:${MUTED};">Unsubscribe</a><br>${esc(parts.marketing.postalAddress)}`
      : ""
  }</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const textLines: string[] = [parts.lead, ""];
  for (const b of buttons) textLines.push(`${b.label}: ${b.url}`);
  if (buttons.length) textLines.push("");
  for (const b of blocks) {
    if (b.type === "p") textLines.push(b.text, "");
    else if (b.type === "ul") textLines.push(...b.items.map((i) => `- ${i}`), "");
    else if (b.type === "ol") textLines.push(...b.items.map((i, n) => `${n + 1}. ${i}`), "");
    else if (b.type === "note") textLines.push(`${b.label}: ${b.text}`, "");
    else if (b.type === "image") textLines.push(b.caption ?? "", "");
  }
  if (parts.signOff) textLines.push("The motori.us team", "");
  textLines.push("--", footerNote, "Reply to this email to reach us.");
  if (parts.marketing) {
    textLines.push("", `${parts.marketing.reason} Unsubscribe: ${parts.marketing.unsubscribeUrl}`, parts.marketing.postalAddress);
  }

  return { html, text: textLines.join("\n").replace(/\n{3,}/g, "\n\n") };
}
