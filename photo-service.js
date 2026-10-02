/* ============================================================================
   PHOTO & 3D BUD SERVICE (photo-service.js)
   Purpose: Central helpers for building Cloudflare R2 image URLs and
            checking whether media files actually exist before loading.
   Used by: app.js (loadPhoto, 3D bud viewer / spinzam frames)
============================================================================ */

/**
 * Base URL of the public Cloudflare R2 bucket that holds diagnostic photos
 * and 3D bud-scan frame sequences.
 * Change this only if the bucket domain changes.
 */
export const R2_BASE = "https://pub-7c0f1ea1e4264248a09ee567d8bcda6f.r2.dev";

/**
 * Turns a species common or scientific name into a safe URL slug.
 * Example: "Red Maple" → "red_maple"
 * Used by every image-URL builder below.
 */
export function formatSpeciesSlug(name) {
  if (!name) return "";
  return name.toLowerCase().trim().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");
}

/**
 * Builds the full R2 URL for a diagnostic photo (leaf, bark, etc.).
 * part defaults to "leaf". Example result:
 *   https://…/red_maple_image/red_maple_leaf_image.jpg
 */
export function getDiagnosticPhotoUrl(speciesName, part = "leaf") {
  const slug = formatSpeciesSlug(speciesName);
  return `${R2_BASE}/${slug}_image/${slug}_${part}_image.jpg`;
}

/**
 * Builds the URL for a single frame of a 3D bud-scan sequence.
 * Frames are zero-padded (frame_00.jpg, frame_01.jpg, …).
 * Used when the Interactive 3D Scan button is available.
 */
export function getBudScanFrameUrl(speciesName, frameIndex = 0) {
  const slug = formatSpeciesSlug(speciesName);
  const pad = String(frameIndex).padStart(2, "0");
  return `${R2_BASE}/${slug}_image/3d_bud_scan/frame_${pad}.jpg`;
}

/**
 * HEAD-request check: returns true if the given media URL exists on R2.
 * Prevents broken-image placeholders when a species has no photo yet.
 */
export async function checkMediaExists(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}
