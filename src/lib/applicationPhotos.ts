import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Private bucket: application photos aren't public until the applicant is
// approved and becomes a Builder (Phase 2 only handles the application
// side; publishing photos into a public bucket happens in the Submit Build
// flow, Chunk C).
export const APPLICATION_PHOTOS_BUCKET = "application-photos";

let bucketEnsured = false;

/**
 * Creates the private bucket on first use. Safe to call on every request --
 * no-ops once it exists. Avoids requiring a manual Supabase dashboard step
 * for storage setup.
 */
export async function ensureApplicationPhotosBucket() {
  if (bucketEnsured) return;
  const supabase = getSupabaseAdmin();
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === APPLICATION_PHOTOS_BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(APPLICATION_PHOTOS_BUCKET, {
      public: false,
      fileSizeLimit: "10MB",
      allowedMimeTypes: ["image/jpeg", "image/png", "image/heic", "image/webp"],
    });
    // Ignore a race where another request created it first.
    if (error && !/already exists/i.test(error.message)) {
      throw error;
    }
  }
  bucketEnsured = true;
}

export async function uploadApplicationPhoto(
  userId: string,
  file: File
): Promise<string> {
  await ensureApplicationPhotosBucket();
  const supabase = getSupabaseAdmin();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(APPLICATION_PHOTOS_BUCKET)
    .upload(path, buffer, { contentType: file.type || "image/jpeg" });
  if (error) throw error;
  return path;
}

export async function deleteApplicationPhotos(paths: string[]) {
  if (paths.length === 0) return;
  const supabase = getSupabaseAdmin();
  await supabase.storage.from(APPLICATION_PHOTOS_BUCKET).remove(paths);
}

/** Signed URLs so the applicant (and later, Admin) can view private photos. */
export async function signApplicationPhotoUrls(paths: string[]): Promise<string[]> {
  if (paths.length === 0) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(APPLICATION_PHOTOS_BUCKET)
    .createSignedUrls(paths, 60 * 60); // 1 hour
  if (error) throw error;
  return (data ?? []).map((d) => d.signedUrl).filter((url): url is string => Boolean(url));
}
