// Admin uploads are resized in the BROWSER before they are posted. Doing it in
// the Worker would be seconds of CPU against a 10ms free-plan cap, and without
// it every admin upload silently bypasses the build-time image pipeline — a
// 6.9 MB /instructors page is what that looks like (spec §7.3 M5).

/** Longest edge, in pixels, an upload keeps after the client-side resize. */
export const UPLOAD_MAX_EDGE_PX = 1600;

/** Pure: the box `width x height` fits into, scaled down only, never up. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (!Number.isFinite(longest) || longest <= 0) return { width: 0, height: 0 };
  if (longest <= maxEdge) return { width: Math.round(width), height: Math.round(height) };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Best-effort. Every failure path returns the ORIGINAL file: a browser without
 * OffscreenCanvas, an image the decoder rejects, a re-encode that came out
 * larger. Refusing to upload would be a worse outcome than uploading big, and
 * the server-side dimension ceiling still backstops it.
 */
export async function downscaleImageFile(
  file: File,
  maxEdge: number = UPLOAD_MAX_EDGE_PX,
): Promise<File> {
  const g = globalThis as {
    createImageBitmap?: unknown;
    OffscreenCanvas?: unknown;
  };
  if (typeof g.createImageBitmap !== 'function' || typeof g.OffscreenCanvas !== 'function') {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const target = fitWithin(bitmap.width, bitmap.height, maxEdge);
    if (target.width === bitmap.width && target.height === bitmap.height) return file;

    const canvas = new OffscreenCanvas(target.width, target.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, target.width, target.height);

    // WebP, not AVIF: convertToBlob's AVIF support is uneven across browsers
    // and a rejected promise here costs the admin their upload. The build-time
    // pipeline is where AVIF is produced.
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 });
    if (!blob || blob.size >= file.size) return file;

    const stem = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${stem}.webp`, { type: 'image/webp' });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}
