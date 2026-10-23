import type { Metadata } from "next";
import LegalDocumentView from "@/components/LegalDocumentView";
import { getDisplayDoc } from "@/lib/legal/server";

// Read per request so the page always shows the version on file.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy Policy | motori.us",
  description: "Privacy Policy for motori.us.",
  alternates: { canonical: "https://www.motori.us/privacy" },
};

export default async function Page() {
  const d = await getDisplayDoc("privacy");
  return <LegalDocumentView doc={{ ...d, isCurrent: true }} />;
}
