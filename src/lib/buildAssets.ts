import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Both private buckets, same as application-photos: Build photos and
// documents are never public, even once a Build is published -- the public
// Build page generates signed URLs server-side at render time instead.
export const BUILD_PHOTOS_BUCKET = "build-photos";
export const BUILD_DOCUMENTS_BUCKET = "build-documents";

export const MAX_BUILD_PHOTOS = 30;
export const MAX_BUILD_DOCUMENTS = 10;

let photosBucketEnsured = false;
let documentsBucketEnsured = false;

async function ensureBucket(
  name: string,
  opts: { fileSizeLimit: string; allowedMimeTypes: string[] }
) {
  const supabase = getSupabaseAdmin();
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === name);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(name, {
      public: false,
      ...opts,
    });
    if (error && !/already exists/i.test(error.message)) {
      throw error;
    }
  }
}

export async function ensureBuildPhotosBucket() {
  if (photosBucketEnsured) return;
  await ensureBucket(BUILD_PHOTOS_BUCKET, {
    fileSizeLimit: "15MB",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/heic", "image/webp"],
  });
  photosBucketEnsured = true;
}

export async function ensureBuildDocumentsBucket() {
  if (documentsBucketEnsured) return;
  await ensureBucket(BUILD_DOCUMENTS_BUCKET, {
    fileSizeLimit: "25MB",
    allowedMimeTypes: ["application/pdf"],
  });
  documentsBucketEnsured = true;
}

export interface BuildPhoto {
  path: string;
  caption?: string;
  category?: string;
}

export interface BuildDocument {
  path: string;
  filename: string;
}

export async function uploadBuildPhoto(builderId: string, file: File): Promise<string> {
  await ensureBuildPhotosBucket();
  const supabase = getSupabaseAdmin();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${builderId}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(BUILD_PHOTOS_BUCKET)
    .upload(path, buffer, { contentType: file.type || "image/jpeg" });
  if (error) throw error;
  return path;
}

export async function uploadBuildDocument(
  builderId: string,
  file: File
): Promise<BuildDocument> {
  await ensureBuildDocumentsBucket();
  const supabase = getSupabaseAdmin();
  const path = `${builderId}/${crypto.randomUUID()}.pdf`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(BUILD_DOCUMENTS_BUCKET)
    .upload(path, buffer, { contentType: "application/pdf" });
  if (error) throw error;
  return { path, filename: file.name };
}

export async function deleteBuildPhotos(paths: string[]) {
  if (paths.length === 0) return;
  const supabase = getSupabaseAdmin();
  await supabase.storage.from(BUILD_PHOTOS_BUCKET).remove(paths);
}

export async function deleteBuildDocuments(paths: string[]) {
  if (paths.length === 0) return;
  const supabase = getSupabaseAdmin();
  await supabase.storage.from(BUILD_DOCUMENTS_BUCKET).remove(paths);
}

export async function signBuildPhotoUrls(photos: BuildPhoto[]): Promise<string[]> {
  if (photos.length === 0) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(BUILD_PHOTOS_BUCKET)
    .createSignedUrls(photos.map((p) => p.path), 60 * 60); // 1 hour
  if (error) throw error;
  return (data ?? []).map((d) => d.signedUrl).filter((url): url is string => Boolean(url));
}

export async function signBuildDocumentUrls(
  documents: BuildDocument[]
): Promise<{ filename: string; url: string }[]> {
  if (documents.length === 0) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(BUILD_DOCUMENTS_BUCKET)
    .createSignedUrls(documents.map((d) => d.path), 60 * 60);
  if (error) throw error;
  return (data ?? []).map((d, i) => ({ filename: documents[i].filename, url: d.signedUrl ?? "" }));
}
