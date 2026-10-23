import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { LEGAL_DOCS, LEGAL_DOC_TYPES, sha256, type LegalDocType } from "./documents";

/**
 * Server side of the legal system: keeps the current versions on file,
 * works out what a user still has to accept, and records acceptances.
 */

export interface StoredLegalDoc {
  type: LegalDocType;
  version: string;
  title: string;
  path: string;
  effectiveDate: string;
  changeSummary: string;
  markdown: string;
  sha256: string;
}

let ensured: Promise<Record<LegalDocType, StoredLegalDoc>> | null = null;

/**
 * Makes sure the current version of every document is stored (once per server
 * instance) and returns what is ON FILE. The stored text is the truth: pages
 * and acceptances always agree, even if the code's text is edited without a
 * version bump (that is logged so it gets noticed).
 */
export function ensureLegalDocs(): Promise<Record<LegalDocType, StoredLegalDoc>> {
  if (!ensured) {
    ensured = load().catch((err) => {
      ensured = null; // retry next request
      throw err;
    });
  }
  return ensured;
}

async function load(): Promise<Record<LegalDocType, StoredLegalDoc>> {
  const supabase = getSupabaseAdmin();
  const out = {} as Record<LegalDocType, StoredLegalDoc>;
  for (const type of LEGAL_DOC_TYPES) {
    const doc = LEGAL_DOCS[type];
    const hash = sha256(doc.markdown);
    let { data: row } = await supabase
      .from("legal_documents")
      .select("*")
      .eq("doc_type", type)
      .eq("version", doc.version)
      .maybeSingle();
    if (!row) {
      const inserted = await supabase
        .from("legal_documents")
        .insert({
          doc_type: type,
          version: doc.version,
          title: doc.title,
          effective_date: doc.effectiveDate,
          content_md: doc.markdown,
          content_sha256: hash,
          change_summary: doc.changeSummary,
        })
        .select("*")
        .single();
      if (inserted.error) {
        // A parallel instance may have inserted it first.
        const again = await supabase
          .from("legal_documents")
          .select("*")
          .eq("doc_type", type)
          .eq("version", doc.version)
          .maybeSingle();
        row = again.data;
        if (!row) throw new Error(`Could not store legal document ${type}: ${inserted.error.message}`);
      } else {
        row = inserted.data;
      }
    } else if (row.content_sha256 !== hash) {
      console.error(
        `[legal] ${type} ${doc.version}: the text in code differs from what is on file. ` +
          `Serving the stored text. Bump the version in src/lib/legal/documents.ts to publish the change.`
      );
    }
    out[type] = {
      type,
      version: row.version,
      title: row.title,
      path: doc.path,
      effectiveDate: row.effective_date,
      changeSummary: row.change_summary ?? "",
      markdown: row.content_md,
      sha256: row.content_sha256,
    };
  }
  return out;
}

/**
 * The current version of one document for display. If the database can't be
 * reached the page still shows the text from code, so the legal pages never go down.
 */
export async function getDisplayDoc(type: LegalDocType): Promise<StoredLegalDoc> {
  try {
    return (await ensureLegalDocs())[type];
  } catch (err) {
    console.error("[legal] database unavailable, showing the text from code:", err);
    const d = LEGAL_DOCS[type];
    return {
      type,
      version: d.version,
      title: d.title,
      path: d.path,
      effectiveDate: d.effectiveDate,
      changeSummary: d.changeSummary,
      markdown: d.markdown,
      sha256: sha256(d.markdown),
    };
  }
}

/** Documents a signed-in user has to have accepted, by role. */
export function requiredDocTypes(role: string | null | undefined): LegalDocType[] {
  return role === "builder" || role === "admin" ? ["terms", "privacy", "builder_terms"] : ["terms", "privacy"];
}

/** Which of `types` the user has NOT accepted at the current version. */
export async function missingAcceptances(userId: string, types: LegalDocType[]): Promise<StoredLegalDoc[]> {
  const docs = await ensureLegalDocs();
  const { data } = await getSupabaseAdmin()
    .from("legal_acceptances")
    .select("doc_type, version")
    .eq("user_id", userId)
    .in("doc_type", types);
  const have = new Set((data ?? []).map((r) => `${r.doc_type}:${r.version}`));
  return types.map((t) => docs[t]).filter((d) => !have.has(`${d.type}:${d.version}`));
}

export function requestMeta(req: NextRequest): { ip: string | null; userAgent: string | null } {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip");
  return { ip: ip || null, userAgent: (req.headers.get("user-agent") || "").slice(0, 400) || null };
}

export interface AcceptEntry {
  type: LegalDocType;
  version: string;
}

/** Records acceptances. Only the CURRENT version of a document can be accepted. */
export async function recordAcceptances(
  req: NextRequest,
  userId: string,
  entries: AcceptEntry[],
  context: "gate" | "application" | "build_submit",
  buildId?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const docs = await ensureLegalDocs();
  const meta = requestMeta(req);
  const rows = [];
  for (const e of entries) {
    const doc = docs[e.type];
    if (!doc || doc.version !== e.version) {
      return { ok: false, error: "These terms were just updated. Please reload the page and review the latest version." };
    }
    rows.push({
      user_id: userId,
      doc_type: doc.type,
      version: doc.version,
      content_sha256: doc.sha256,
      context,
      build_id: buildId ?? null,
      ip: meta.ip,
      user_agent: meta.userAgent,
    });
  }
  if (rows.length === 0) return { ok: true };
  const { error } = await getSupabaseAdmin().from("legal_acceptances").insert(rows);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export function parseAcceptEntries(raw: unknown): AcceptEntry[] {
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (e): e is AcceptEntry =>
          e && typeof e.version === "string" && (LEGAL_DOC_TYPES as string[]).includes(e.type)
      )
      .map((e) => ({ type: e.type, version: e.version }));
  } catch {
    return [];
  }
}

/** The 409 body routes return when acceptance is missing. */
export function termsRequiredBody(missing: StoredLegalDoc[]) {
  return {
    error: "Please review and accept the latest terms to continue.",
    code: "terms_required",
    missing: missing.map((d) => ({ type: d.type, title: d.title, version: d.version, path: d.path })),
  };
}
