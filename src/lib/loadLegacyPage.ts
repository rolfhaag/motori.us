import fs from "node:fs";
import path from "node:path";

export interface LegacyPageData {
  title: string;
  description: string;
  ogImage: string;
  canonical: string;
  bodyHtml: string;
}

const LEGACY_DIR = path.join(process.cwd(), "src", "legacy-pages");

/**
 * Reads one of the migrated static HTML files and pulls out what Next.js
 * needs: the <title>/meta tags (for generateMetadata) and the <body> inner
 * HTML (rendered as-is so the existing design/markup/behavior is preserved
 * exactly during the Phase 1 migration).
 */
export function loadLegacyPage(fileName: string): LegacyPageData {
  const raw = fs.readFileSync(path.join(LEGACY_DIR, fileName), "utf8");

  const title = /<title>([^<]*)<\/title>/.exec(raw)?.[1] ?? "motori.us";
  const description =
    /<meta property="og:description" content="([^"]*)"/.exec(raw)?.[1] ?? "";
  const ogImage =
    /<meta property="og:image" content="([^"]*)"/.exec(raw)?.[1] ?? "";
  const canonical =
    /<link rel="canonical" href="([^"]*)"/.exec(raw)?.[1] ?? "";

  const bodyMatch = /<body>([\s\S]*)<\/body>/.exec(raw);
  let bodyHtml = bodyMatch ? bodyMatch[1] : "";

  // Strip <script> tags from the body: content injected via
  // dangerouslySetInnerHTML is not executed by the browser, so the
  // page's interactive scripts are loaded separately via next/script
  // in each route's component instead.
  bodyHtml = bodyHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");

  return { title, description, ogImage, canonical, bodyHtml };
}
