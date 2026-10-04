import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Assigns a Build's public slug at publish time (builds.slug is null until
 * then -- see 0002_phase2.sql). Derived from make/model/trim rather than
 * asked of the Builder, since it's a URL concern, not content they type in.
 * Collision-checked against existing slugs and disambiguated with a short
 * random suffix if needed.
 */
export async function assignBuildSlug(
  make: string | null,
  model: string | null,
  trim: string | null
): Promise<string> {
  const base =
    [make, model, trim]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "build";

  const supabase = getSupabaseAdmin();

  const { data: exact } = await supabase.from("builds").select("id").eq("slug", base).maybeSingle();
  if (!exact) return base;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: match } = await supabase
      .from("builds")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!match) return candidate;
  }

  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}
