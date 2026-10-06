import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { BUILD_PHOTOS_BUCKET, BuildPhoto } from "@/lib/buildAssets";
import { E9_SLUG, E9_SHARE_PHOTOS } from "@/lib/shareKit";

export const dynamic = "force-dynamic";

/**
 * Share-kit image: photo number `n` of a published, public Build, cropped to
 * 4:5 (1080x1350, Instagram's feed portrait size). Like the link-preview
 * image it's served from here because the photo bucket is private. The crop
 * uses sharp's "attention" strategy to keep the most interesting part of the
 * photo in frame.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; n: string }> }) {
  const { slug, n } = await params;
  const index = Number(n);
  if (!Number.isInteger(index) || index < 0 || index > 9) return new NextResponse(null, { status: 404 });

  const { data: build } = await getSupabaseAdmin()
    .from("builds")
    .select("photos")
    .eq("slug", slug)
    .eq("status", "published")
    .eq("visibility", "public")
    .eq("hidden", false)
    .maybeSingle();
  if (!build) return new NextResponse(null, { status: 404 });

  let input: Buffer | null = null;
  const photos = (build.photos ?? []) as BuildPhoto[];
  if (photos.length > 0) {
    const photo = photos[index];
    if (!photo) return new NextResponse(null, { status: 404 });
    const { data: file, error } = await getSupabaseAdmin().storage.from(BUILD_PHOTOS_BUCKET).download(photo.path);
    if (error || !file) return new NextResponse(null, { status: 404 });
    input = Buffer.from(await file.arrayBuffer());
  } else if (slug === E9_SLUG) {
    // The E9's page was hand-built, so its photos live in /public/images.
    const name = E9_SHARE_PHOTOS[index];
    if (!name) return new NextResponse(null, { status: 404 });
    input = fs.readFileSync(path.join(process.cwd(), "public", "images", name));
  }
  if (!input) return new NextResponse(null, { status: 404 });

  try {
    const jpeg = await sharp(input)
      .rotate()
      .resize(1080, 1350, { fit: "cover", position: sharp.strategy.attention })
      .jpeg({ quality: 86 })
      .toBuffer();
    return new NextResponse(new Uint8Array(jpeg), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
