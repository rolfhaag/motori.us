import SiteHeader from "@/components/SiteHeader";
import { renderLegalMarkdown, type LegalDocType } from "@/lib/legal/documents";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export interface LegalViewDoc {
  type: LegalDocType;
  version: string;
  title: string;
  effectiveDate: string;
  markdown: string;
  isCurrent: boolean;
}

function fmt(d: string) {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/** A legal document page: the text, its version and date, and earlier versions. */
export default async function LegalDocumentView({ doc }: { doc: LegalViewDoc }) {
  let versions: { version: string; effective_date: string }[] = [];
  try {
    const { data } = await getSupabaseAdmin()
      .from("legal_documents")
      .select("version, effective_date")
      .eq("doc_type", doc.type)
      .order("effective_date", { ascending: false });
    versions = data ?? [];
  } catch {
    /* version list is a nicety */
  }
  const earlier = versions.filter((v) => v.version !== doc.version);

  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero compact">
          <div className="wrap">
            <p className="eyebrow">Legal</p>
            <h1 className="title mid">{doc.title}</h1>
            <p className="thesis">
              Version {doc.version}, effective {fmt(doc.effectiveDate)}
              {doc.isCurrent ? "" : ". This is an earlier version, kept on file."}
            </p>
          </div>
        </section>
        <section>
          <div className="wrap">
            <article className="legal" dangerouslySetInnerHTML={{ __html: renderLegalMarkdown(doc.markdown) }} />
            <nav className="legal-links">
              <a href="/terms">Terms of Use</a>
              <a href="/builder-terms">Builder Terms</a>
              <a href="/privacy">Privacy Policy</a>
              {!doc.isCurrent && <a href={`/${doc.type === "builder_terms" ? "builder-terms" : doc.type}`}>Current version</a>}
            </nav>
            {earlier.length > 0 && (
              <p className="legal-earlier">
                Earlier versions:{" "}
                {earlier.map((v, i) => (
                  <span key={v.version}>
                    {i > 0 && ", "}
                    <a href={`/legal/${doc.type}/${v.version}`}>{v.version}</a>
                  </span>
                ))}
              </p>
            )}
          </div>
        </section>
      </main>
      <footer>
        <div className="wrap">
          <span>motori.us: one open record for every build.</span>
        </div>
      </footer>
    </>
  );
}
