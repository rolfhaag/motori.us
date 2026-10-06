import { createHash } from "crypto";

/**
 * Fingerprint of everything the AI draft is generated from. Photo/PDF order
 * is deliberately excluded (reordering or picking a hero doesn't change what
 * the AI saw), and so is VIN (never sent to the AI as page content).
 */
export function draftInputHash(b: {
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  theme?: string | null;
  photos?: { path: string }[] | null;
  documents?: { path: string }[] | null;
}): string {
  const payload = JSON.stringify({
    make: (b.make ?? "").trim(),
    model: (b.model ?? "").trim(),
    trim: (b.trim ?? "").trim(),
    theme: (b.theme ?? "").trim(),
    photos: (b.photos ?? []).map((p) => p.path).sort(),
    documents: (b.documents ?? []).map((d) => d.path).sort(),
  });
  return createHash("sha256").update(payload).digest("hex");
}

/** True when a draft exists but its inputs have since changed. */
export function isDraftStale(b: Parameters<typeof draftInputHash>[0] & {
  draft_content?: unknown;
  draft_input_hash?: string | null;
}): boolean {
  if (!b.draft_content || !b.draft_input_hash) return false;
  return draftInputHash(b) !== b.draft_input_hash;
}
