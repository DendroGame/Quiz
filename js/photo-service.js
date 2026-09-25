/* ============================================================================
   PHOTO SERVICE (js/photo-service.js)
   ---------------------------------------------------------------------------
   Fetches diagnostic pictures and 360° rotational bud turntable frames
   directly from your Cloudflare R2 bucket.
============================================================================ */

// Live public Cloudflare R2 bucket endpoint
export const R2_BASE = "https://pub-7c0f1ea1e4264248a09ee567d8bcda6f.r2.dev";

/**
 * Normalizes common or scientific plant names to match the R2 folder structure.
 * Example: "Yellow Willow" -> "yellow_willow"
 */
export function formatSpeciesSlug(name) {
  if (!name) return "";
  return name.toLowerCase().trim().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");
}

/**
 * Generates the direct URL for a diagnostic photo.
 * @param {string} speciesName - Common or scientific name
 * @param {string} part - "leaf", "bark", "twig", "flower", "fruit", or "form"
 */
export function getDiagnosticPhotoUrl(speciesName, part = "leaf") {
  const slug = formatSpeciesSlug(speciesName);
  return `${R2_BASE}/${slug}_image/${slug}_${part}_image.jpg`;
}

/**
 * Generates the direct URL for a 360° bud turntable frame.
 * @param {string} speciesName - Common or scientific name
 * @param {number} frameIndex - 0 to 35
 */
export function getBudScanFrameUrl(speciesName, frameIndex = 0) {
  const slug = formatSpeciesSlug(speciesName);
  const pad = String(frameIndex).padStart(2, "0");
  return `${R2_BASE}/${slug}_image/3d_bud_scan/frame_${pad}.jpg`;
}

/**
 * Loads a species diagnostic image into an HTML <img> element with fallback checks.
 * @param {string} speciesName - Tree name
 * @param {HTMLImageElement} imgElement - The target <img> DOM element
 * @param {HTMLElement} [loadingSpinner] - Optional loading indicator element
 */
export function loadSpeciesPhoto(speciesName, imgElement, loadingSpinner = null) {
  if (!imgElement || !speciesName) return;

  if (loadingSpinner) loadingSpinner.classList.remove("hidden");
  imgElement.classList.add("hidden");

  const slug = formatSpeciesSlug(speciesName);
  const preferredParts = ["leaf", "form", "bark", "fruit", "twig"];
  let partIndex = 0;

  function attemptLoad() {
    if (partIndex >= preferredParts.length) {
      // All image variants failed
      if (loadingSpinner) loadingSpinner.classList.add("hidden");
      imgElement.removeAttribute("src");
      return;
    }

    const testUrl = `${R2_BASE}/${slug}_image/${slug}_${preferredParts[partIndex]}_image.jpg`;
    imgElement.src = testUrl;

    imgElement.onload = () => {
      if (loadingSpinner) loadingSpinner.classList.add("hidden");
      imgElement.classList.remove("hidden");
    };

    imgElement.onerror = () => {
      partIndex++;
      attemptLoad();
    };
  }

  attemptLoad();
}
