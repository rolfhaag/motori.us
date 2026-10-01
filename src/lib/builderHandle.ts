import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const HANDLE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidHandleFormat(handle: string): boolean {
  return handle.length >= 3 && handle.length <= 30 && HANDLE_PATTERN.test(handle);
}

/**
 * True if `handle` is free: not used by any approved Builder, and not the
 * desired handle on anyone else's active (non-terminal) application. Excludes
 * `excludeApplicationId` so an applicant re-saving their own draft with the
 * same handle doesn't collide with themselves.
 */
export async function isHandleAvailable(
  handle: string,
  excludeApplicationId?: string
): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const { data: builderMatch } = await supabase
    .from("builders")
    .select("user_id")
    .eq("handle", handle)
    .maybeSingle();
  if (builderMatch) return false;

  let query = supabase
    .from("applications")
    .select("id")
    .eq("handle", handle)
    .in("status", ["draft", "submitted", "denied_resubmit"]);
  if (excludeApplicationId) {
    query = query.neq("id", excludeApplicationId);
  }
  const { data: applicationMatches } = await query;
  return !applicationMatches || applicationMatches.length === 0;
}
