/**
 * Phase 7A/7B audit fix — pin the contract of the shared `imageSrc`
 * helper so future call-sites cannot regress on the four input shapes
 * the catalog and admin UIs actually pass.
 */
import { describe, it, expect } from 'vitest';

import { imageSrc } from '../imageSrc';

describe('imageSrc', () => {
  it('returns empty string for empty input', () => {
    expect(imageSrc('')).toBe('');
  });

  it('passes through absolute http/https URLs unchanged', () => {
    expect(imageSrc('https://cdn.example.com/p.jpg')).toBe(
      'https://cdn.example.com/p.jpg',
    );
    expect(imageSrc('http://localhost:9000/x.png')).toBe(
      'http://localhost:9000/x.png',
    );
  });

  it('passes through data: URIs unchanged', () => {
    const data =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAen63NgAAAAASUVORK5CYII=';
    expect(imageSrc(data)).toBe(data);
  });

  it('passes through root-anchored static paths unchanged (legacy SEED_DESIGNS)', () => {
    // The bug fix from the Phase 7A/7B audit: previously these paths
    // were rewritten to `/uploads//images/foo.jpg` (404).
    expect(imageSrc('/images/design-1.jpg')).toBe('/images/design-1.jpg');
    expect(imageSrc('/icons/banner.svg')).toBe('/icons/banner.svg');
  });

  it('prefixes /uploads/ for storage-relative paths from AdminFileUpload', () => {
    expect(imageSrc('BANNER/abc.jpg')).toBe('/uploads/BANNER/abc.jpg');
    expect(imageSrc('PANEL_PHOTO/xyz.png')).toBe(
      '/uploads/PANEL_PHOTO/xyz.png',
    );
  });

  it('idempotently strips a leading `uploads/` prefix', () => {
    // A caller that already prepended `uploads/` gets the same final URL
    // as one that passed the bare storage-relative form.
    expect(imageSrc('uploads/BANNER/abc.jpg')).toBe('/uploads/BANNER/abc.jpg');
  });
});
