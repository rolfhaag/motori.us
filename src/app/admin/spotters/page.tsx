"use client";

import AdminShell from "@/components/AdminShell";
import AdminSpotters from "@/components/AdminSpotters";

export default function AdminSpottersPage() {
  return <AdminShell title="Spotters">{(authedFetch) => <AdminSpotters authedFetch={authedFetch} />}</AdminShell>;
}
