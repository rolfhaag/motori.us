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
 * 1080 wide, in a frame shaped like the hero photo (kept within Instagram's
 * 1.91:1 to 4:5 limits). Like the link-preview image it's served from here
 * because the photo bucket is private. Photos of a different shape are shown
 * whole over a blurred copy rather than cropped.
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

  // Load photo `n` and the hero (photo 0): the hero's shape sets the frame for
  // the whole set, because Instagram crops every carousel slide to the first
  // slide's shape.
  const load = async (i: number): Promise<Buffer | null> => {
    const photos = (build.photos ?? []) as BuildPhoto[];
    if (photos.length > 0) {
      const photo = photos[i];
      if (!photo) return null;
      const { data: file, error } = await getSupabaseAdmin().storage.from(BUILD_PHOTOS_BUCKET).download(photo.path);
      if (error || !file) return null;
      return Buffer.from(await file.arrayBuffer());
    }
    if (slug === E9_SLUG) {
      // The E9's page was hand-built, so its photos live in /public/images.
      const name = E9_SHARE_PHOTOS[i];
      return name ? fs.readFileSync(path.join(process.cwd(), "public", "images", name)) : null;
    }
    return null;
  };
  const input = await load(index);
  if (!input) return new NextResponse(null, { status: 404 });
  const heroInput = index === 0 ? input : await load(0);

  try {
    const dims = async (buf: Buffer) => {
      const m = await sharp(buf).metadata();
      const swap = (m.orientation ?? 1) >= 5; // EXIF rotation swaps width and height
      return { w: (swap ? m.height : m.width) ?? 1, h: (swap ? m.width : m.height) ?? 1 };
    };
    const hero = await dims(heroInput ?? input);
    const mine = await dims(input);

    // Instagram feed posts allow shapes from 1.91:1 (wide) to 4:5 (tall). The
    // frame follows the hero photo, clamped to that range, so a landscape car
    // stays landscape instead of being zoomed into a tall crop.
    const frameRatio = Math.min(1.91, Math.max(0.8, hero.w / hero.h));
    const W = 1080;
    const H = Math.round(W / frameRatio);
    const ratio = mine.w / mine.h;

    let jpeg: Buffer;
    if (Math.abs(ratio / frameRatio - 1) <= 0.15) {
      // Close to the frame's shape: a light crop loses very little.
      jpeg = await sharp(input)
        .rotate()
        .resize(W, H, { fit: "cover", position: sharp.strategy.attention })
        .jpeg({ quality: 86 })
        .toBuffer();
    } else {
      // A different shape (e.g. a portrait shot in a landscape set): show the
      // whole photo, centered over a blurred, darkened copy of itself.
      const background = await sharp(input)
        .rotate()
        .resize(W, H, { fit: "cover" })
        .blur(30)
        .modulate({ brightness: 0.6 })
        .toBuffer();
      const foreground = await sharp(input)
        .rotate()
        .resize(W, H, { fit: "inside", withoutEnlargement: false })
        .toBuffer();
      jpeg = await sharp(background)
        .composite([{ input: foreground, gravity: "centre" }])
        .jpeg({ quality: 86 })
        .toBuffer();
    }
    return new NextResponse(new Uint8Array(jpeg), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
