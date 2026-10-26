import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { displayName } from "@/lib/builderListings";

/**
 * How a Builder's name reads on the site: the display name they (or Admin)
 * set, else the hand-tuned override, else the handle tidied up.
 */
export async function builderNames(handles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(handles.filter(Boolean))];
  for (const h of unique) out.set(h, displayName(h));
  if (unique.length === 0) return out;
  const { data } = await getSupabaseAdmin().from("builders").select("handle, display_name").in("handle", unique);
  for (const r of data ?? []) if (r.display_name) out.set(r.handle, r.display_name as string);
  return out;
}

export async function builderName(handle: string): Promise<string> {
  return (await builderNames([handle])).get(handle) ?? displayName(handle);
}

/** Display names are plain text, 2 to 40 characters. Returns the cleaned name or null. */
export function cleanDisplayName(raw: unknown): string | null {
  const s = String(raw ?? "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim();
  return s.length >= 2 && s.length <= 40 ? s : null;
}
