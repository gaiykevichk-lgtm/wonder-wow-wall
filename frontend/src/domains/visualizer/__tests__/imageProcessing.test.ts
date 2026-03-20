import { describe, it, expect } from 'vitest';
import { validateImageFile, validateImageDimensions } from '../lib/imageProcessing';

describe('imageProcessing', () => {
  describe('validateImageFile', () => {
    it('accepts JPEG files', () => {
      const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
      expect(validateImageFile(file).valid).toBe(true);
    });

    it('accepts PNG files', () => {
      const file = new File(['test'], 'photo.png', { type: 'image/png' });
      expect(validateImageFile(file).valid).toBe(true);
    });

    it('accepts WebP files', () => {
      const file = new File(['test'], 'photo.webp', { type: 'image/webp' });
      expect(validateImageFile(file).valid).toBe(true);
    });

    it('accepts HEIC files by extension', () => {
      const file = new File(['test'], 'photo.heic', { type: '' });
      expect(validateImageFile(file).valid).toBe(true);
    });

    it('rejects unsupported formats', () => {
      const file = new File(['test'], 'doc.pdf', { type: 'application/pdf' });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('не поддерживается');
    });

    it('rejects files larger than 20MB', () => {
      const bigContent = new Uint8Array(21 * 1024 * 1024);
      const file = new File([bigContent], 'huge.jpg', { type: 'image/jpeg' });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('большой');
    });

    it('accepts files just under 20MB', () => {
      const content = new Uint8Array(19 * 1024 * 1024);
      const file = new File([content], 'ok.jpg', { type: 'image/jpeg' });
      expect(validateImageFile(file).valid).toBe(true);
    });
  });

  describe('validateImageDimensions', () => {
    it('accepts valid dimensions', () => {
      expect(validateImageDimensions(1920, 1080).valid).toBe(true);
    });

    it('accepts minimum dimensions', () => {
      expect(validateImageDimensions(800, 600).valid).toBe(true);
    });

    it('rejects too small width', () => {
      const result = validateImageDimensions(640, 800);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('низкое');
    });

    it('rejects too small height', () => {
      const result = validateImageDimensions(1920, 400);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('низкое');
    });
  });
});
