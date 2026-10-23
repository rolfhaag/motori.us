/**
 * Shrinks a phone photo in the browser before upload. Serverless hosts cap
 * request bodies (about 4.5 MB on Vercel), and three fresh phone photos easily
 * exceed that, which made submissions fail with a non-JSON error page.
 * Falls back to the original file if the browser can't decode it (e.g. HEIC).
 */
export async function shrinkImage(file: File, maxEdge = 2400, quality = 0.85): Promise<File> {
  try {
    if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
    if (file.size < 900 * 1024) return file;
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

/** Parse a fetch response as JSON, with a readable error for non-JSON replies (e.g. 413). */
export async function readJson(res: Response): Promise<{ error?: string; [k: string]: unknown }> {
  try {
    return await res.json();
  } catch {
    if (res.status === 413) return { error: "Those photos are too large to upload together. Try fewer or smaller photos." };
    return { error: `The server returned an unexpected response (${res.status}). Please try again.` };
  }
}
