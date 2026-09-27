/* ============================================================================
   PHOTO & 3D BUD SERVICE (js/photo-service.js)
============================================================================ */

export const R2_BASE = "https://pub-7c0f1ea1e4264248a09ee567d8bcda6f.r2.dev";

export function formatSpeciesSlug(name) {
  if (!name) return "";
  return name.toLowerCase().trim().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");
}

export function getDiagnosticPhotoUrl(speciesName, part = "leaf") {
  const slug = formatSpeciesSlug(speciesName);
  return `${R2_BASE}/${slug}_image/${slug}_${part}_image.jpg`;
}

export function getBudScanFrameUrl(speciesName, frameIndex = 0) {
  const slug = formatSpeciesSlug(speciesName);
  const pad = String(frameIndex).padStart(2, "0");
  return `${R2_BASE}/${slug}_image/3d_bud_scan/frame_${pad}.jpg`;
}

/**
 * Pre-verifies whether a specific image URL exists on R2
 */
export async function checkMediaExists(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}
