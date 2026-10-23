import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LegalDocumentView from "@/components/LegalDocumentView";
import { isLegalDocType } from "@/lib/legal/documents";
import { ensureLegalDocs } from "@/lib/legal/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

/** Any stored version of a legal document, e.g. /legal/terms/2026-10-19. */
export default async function Page({ params }: { params: Promise<{ type: string; version: string }> }) {
  const { type, version } = await params;
  if (!isLegalDocType(type)) notFound();
  const current = (await ensureLegalDocs())[type];
  const { data } = await getSupabaseAdmin()
    .from("legal_documents")
    .select("version, title, effective_date, content_md")
    .eq("doc_type", type)
    .eq("version", version)
    .maybeSingle();
  if (!data) notFound();
  return (
    <LegalDocumentView
      doc={{
        type,
        version: data.version,
        title: data.title,
        effectiveDate: data.effective_date,
        markdown: data.content_md,
        isCurrent: data.version === current.version,
      }}
    />
  );
}
