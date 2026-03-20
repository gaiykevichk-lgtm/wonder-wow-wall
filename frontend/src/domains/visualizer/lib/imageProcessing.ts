/**
 * Image processing utilities for the Visualizer domain.
 * Handles EXIF correction, resize, format validation.
 */

const SUPPORTED_FORMATS = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_DIMENSION = 2048;
const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateImageFile(file: File): ValidationResult {
  if (!SUPPORTED_FORMATS.has(file.type) && !file.name.match(/\.heic$/i)) {
    return {
      valid: false,
      error: 'Формат не поддерживается. Используйте JPEG, PNG или WebP.',
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Файл слишком большой (${sizeMb} МБ). Максимум — 20 МБ.`,
    };
  }

  return { valid: true };
}

export function createImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось загрузить изображение'));
    };
    img.src = url;
  });
}

export function validateImageDimensions(
  width: number,
  height: number,
): ValidationResult {
  if (width < MIN_WIDTH || height < MIN_HEIGHT) {
    return {
      valid: false,
      error: `Разрешение слишком низкое (${width}×${height}). Минимум — ${MIN_WIDTH}×${MIN_HEIGHT} px.`,
    };
  }
  return { valid: true };
}

/**
 * Resize image to fit within MAX_DIMENSION while preserving aspect ratio.
 * Returns a canvas with the resized image.
 */
export function resizeImage(
  img: HTMLImageElement,
  maxDim: number = MAX_DIMENSION,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  let { naturalWidth: w, naturalHeight: h } = img;

  if (w > maxDim || h > maxDim) {
    const ratio = Math.min(maxDim / w, maxDim / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  ctx.drawImage(img, 0, 0, w, h);
  return { canvas, width: w, height: h };
}

/**
 * Convert canvas to Blob for upload.
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string = 'image/jpeg',
  quality: number = 0.85,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to convert canvas to blob'));
      },
      type,
      quality,
    );
  });
}

/**
 * Full pipeline: validate file → load image → validate dimensions → resize → return data URL and dimensions.
 */
export async function processUploadedImage(file: File): Promise<{
  dataUrl: string;
  width: number;
  height: number;
  blob: Blob;
}> {
  const fileValidation = validateImageFile(file);
  if (!fileValidation.valid) {
    throw new Error(fileValidation.error);
  }

  const img = await createImageFromFile(file);
  const dimValidation = validateImageDimensions(img.naturalWidth, img.naturalHeight);
  if (!dimValidation.valid) {
    URL.revokeObjectURL(img.src);
    throw new Error(dimValidation.error);
  }

  const { canvas, width, height } = resizeImage(img);
  URL.revokeObjectURL(img.src);

  const blob = await canvasToBlob(canvas);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

  return { dataUrl, width, height, blob };
}
