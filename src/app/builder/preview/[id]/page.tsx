"use client";

import { use } from "react";
import BuildPreview from "@/components/BuildPreview";

/** A Builder's own preview of their Build page, exactly as the template renders it. */
export default function BuilderPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <BuildPreview
      apiUrl={`/api/builds/${id}/preview`}
      backHref="/builder"
      backLabel="Back to your dashboard"
      note={(b) =>
        b.status === "published"
          ? "This is your live page."
          : "Only you can see this. It isn't public until it's submitted and approved."
      }
    />
  );
}
