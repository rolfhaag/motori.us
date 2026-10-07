"use client";

import { use } from "react";
import BuildPreview from "@/components/BuildPreview";

/** Admin-only preview of any build, whatever its status (VIN visible). */
export default function AdminPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <BuildPreview
      apiUrl={`/api/admin/builds/${id}/preview`}
      backHref="/admin"
      backLabel="Back to dashboard"
      note={(b) =>
        `Admin preview · ${
          b.status === "published"
            ? b.visibility === "private"
              ? "published privately"
              : "published"
            : `not public (status: ${b.status})`
        }`
      }
    />
  );
}
