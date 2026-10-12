import { NextResponse } from "next/server";
import sharp from "sharp";
import QRCode from "qrcode";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { BUILD_PHOTOS_BUCKET, BuildPhoto } from "@/lib/buildAssets";
import { APPLICATION_PHOTOS_BUCKET } from "@/lib/applicationPhotos";
import { SITE_URL } from "@/lib/siteUrl";
import { verifyImageSignature } from "@/lib/email/heroImage";

export const dynamic = "force-dynamic";

/**
 * Images used inside emails.
 *  - /api/email-image/app/<applicationId>?v=&s=   first application photo
 *  - /api/email-image/build/<buildId>?v=&s=       first build photo (hero)
 *  - /api/email-image/qr/<slug>                   QR code for a public build
 * Photos need a valid signature; the QR only encodes a public page URL, and
 * is only served for published, public builds.
 */
export async function GET(req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const url = new URL(req.url);
  const supabase = getSupabaseAdmin();

  if (kind === "qr") {
    const { data: build } = await supabase
      .from("builds")
      .select("slug")
      .eq("slug", id)
      .eq("status", "published")
      .eq("visibility", "public")
      .eq("hidden", false)
      .maybeSingle();
    if (!build) return new NextResponse(null, { status: 404 });
    const png = await QRCode.toBuffer(`${SITE_URL}/builds/${build.slug}`, {
      width: 520,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    return new NextResponse(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
    });
  }

  if (kind !== "app" && kind !== "build") return new NextResponse(null, { status: 404 });
  const v = url.searchParams.get("v") ?? "";
  const s = url.searchParams.get("s") ?? "";
  if (!verifyImageSignature(kind, id, v, s)) return new NextResponse(null, { status: 403 });

  let bucket: string;
  let path: string | undefined;
  if (kind === "build") {
    const { data } = await supabase.from("builds").select("photos").eq("id", id).maybeSingle();
    path = ((data?.photos ?? []) as BuildPhoto[])[0]?.path;
    bucket = BUILD_PHOTOS_BUCKET;
  } else {
    const { data } = await supabase.from("applications").select("photos").eq("id", id).maybeSingle();
    path = ((data?.photos ?? []) as string[])[0];
    bucket = APPLICATION_PHOTOS_BUCKET;
  }
  if (!path) return new NextResponse(null, { status: 404 });

  const { data: file, error } = await supabase.storage.from(bucket).download(path);
  if (error || !file) return new NextResponse(null, { status: 404 });

  try {
    const jpeg = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize(1200, 630, { fit: "cover" })
      .jpeg({ quality: 80 })
      .toBuffer();
    return new NextResponse(new Uint8Array(jpeg), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    // e.g. a HEIC the bundled image library can't decode: no image, not an error page.
    return new NextResponse(null, { status: 404 });
  }
}
