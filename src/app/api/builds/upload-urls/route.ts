import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError } from "@/lib/verifyRequestUser";
import { requireBuilder } from "@/lib/requireBuilder";
import {
  BUILD_DOCUMENTS_BUCKET,
  BUILD_PHOTOS_BUCKET,
  MAX_BUILD_DOCUMENTS,
  MAX_BUILD_PHOTOS,
  ensureBuildDocumentsBucket,
  ensureBuildPhotosBucket,
} from "@/lib/buildAssets";

const PHOTO_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heic",
};

/**
 * Hands the browser one-time signed URLs so photos and PDFs go straight to
 * Supabase Storage instead of through this server. (Vercel rejects any
 * request body over ~4.5 MB, which a couple of phone photos exceed.) The
 * object path is chosen here, prefixed with the Builder's own id, and the
 * save routes later refuse any path that isn't under that prefix.
 */
export async function POST(req: NextRequest) {
  let builderId: string;
  try {
    ({ builderId } = await requireBuilder(req));
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const photoNames: string[] = Array.isArray(body.photos) ? body.photos.map(String) : [];
  const docNames: string[] = Array.isArray(body.documents) ? body.documents.map(String) : [];
  if (photoNames.length > MAX_BUILD_PHOTOS || docNames.length > MAX_BUILD_DOCUMENTS) {
    return NextResponse.json({ error: "Too many files." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  try {
    await Promise.all([ensureBuildPhotosBucket(), ensureBuildDocumentsBucket()]);

    const photos = await Promise.all(
      photoNames.map(async (name) => {
        const ext = (name.split(".").pop() || "jpg").toLowerCase();
        const contentType = PHOTO_TYPES[ext];
        if (!contentType) throw new Error(`Unsupported photo type: .${ext}`);
        const path = `${builderId}/${crypto.randomUUID()}.${ext}`;
        const { data, error } = await supabase.storage.from(BUILD_PHOTOS_BUCKET).createSignedUploadUrl(path);
        if (error || !data) throw error ?? new Error("Could not sign upload.");
        return { path, signedUrl: data.signedUrl, contentType };
      })
    );
    const documents = await Promise.all(
      docNames.map(async () => {
        const path = `${builderId}/${crypto.randomUUID()}.pdf`;
        const { data, error } = await supabase.storage.from(BUILD_DOCUMENTS_BUCKET).createSignedUploadUrl(path);
        if (error || !data) throw error ?? new Error("Could not sign upload.");
        return { path, signedUrl: data.signedUrl, contentType: "application/pdf" };
      })
    );
    return NextResponse.json({ photos, documents });
  } catch (err) {
    const message = err instanceof Error && err.message.startsWith("Unsupported") ? err.message : "Couldn't prepare the upload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
