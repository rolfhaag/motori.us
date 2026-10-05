import { NextResponse } from "next/server";
import sharp from "sharp";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { BUILD_PHOTOS_BUCKET, BuildPhoto } from "@/lib/buildAssets";

export const dynamic = "force-dynamic";

/**
 * Stable, public link-preview image for a published Build: its first photo,
 * resized to 1200x630. The photo bucket is private (signed URLs expire after
 * an hour), so social crawlers can't be handed a signed URL -- this route
 * serves the bytes itself, and only for published, non-hidden Builds.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = getSupabaseAdmin();

  const { data: build } = await supabase
    .from("builds")
    .select("photos")
    .eq("slug", slug)
    .eq("status", "published")
    .eq("hidden", false)
    .maybeSingle();

  const first = ((build?.photos ?? []) as BuildPhoto[])[0];
  if (!first) return new NextResponse(null, { status: 404 });

  const { data: file, error } = await supabase.storage.from(BUILD_PHOTOS_BUCKET).download(first.path);
  if (error || !file) return new NextResponse(null, { status: 404 });

  try {
    const jpeg = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize(1200, 630, { fit: "cover" })
      .jpeg({ quality: 80 })
      .toBuffer();
    return new NextResponse(new Uint8Array(jpeg), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch {
    // e.g. a HEIC the bundled image library can't decode.
    return new NextResponse(null, { status: 404 });
  }
}
