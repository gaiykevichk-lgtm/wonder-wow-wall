/**
 * Phase 7A/7B audit follow-up — single canonical helper to resolve any
 * "image path" string into a usable `<img src>`.
 *
 * Three input shapes flow through the catalog/admin UIs:
 *
 *   1. Absolute URL (`https://…`, `http://…`) — from external CDNs or
 *      seed data that points at remote assets. Pass through unchanged.
 *
 *   2. Data URI (`data:image/png;base64,…`) — from inline previews
 *      (e.g., the visualizer hands the constructor a generated PNG).
 *      Pass through unchanged.
 *
 *   3. Root-anchored static path (`/images/foo.jpg`, `/icons/bar.svg`)
 *      — legacy `SEED_DESIGNS` rows + Vite static handler / nginx
 *      static. Pass through unchanged. **This was the bug fixed
 *      in remediation 2026-04-25**: previously these paths were
 *      rewritten to `/uploads//images/foo.jpg` (double slash, wrong
 *      location, 404).
 *
 *   4. Storage-relative path (`BANNER/abc.jpg`, `PANEL_PHOTO/xyz.png`)
 *      — what `AdminFileUpload` returns from the Phase 6 endpoint.
 *      nginx serves these under `/uploads/`. The `uploads/` strip is
 *      idempotent so a caller that already prepended the prefix
 *      doesn't get a double-prefixed URL.
 *
 * Empty strings return `''` so the caller can render a placeholder
 * instead of a broken `<img>`.
 *
 * Lifted to `shared/lib/` so 7A `AdminCatalogPage` and 7B
 * `AdminUploadPage` share one truth — the inline copies they had
 * previously diverged in subtle ways (data: URI handling).
 */
export function imageSrc(path: string): string {
  if (!path) return '';
  if (
    path.startsWith('http') ||
    path.startsWith('data:') ||
    path.startsWith('/')
  ) {
    return path;
  }
  return `/uploads/${path.replace(/^uploads\//, '')}`;
}
