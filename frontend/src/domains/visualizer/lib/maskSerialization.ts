/**
 * Convert Uint8Array to base64 string for JSON serialization.
 * Uses chunked approach to avoid O(n²) string concatenation.
 */
export function uint8ArrayToBase64(data: Uint8Array): string {
  const CHUNK = 8192;
  const parts: string[] = [];
  for (let i = 0; i < data.length; i += CHUNK) {
    parts.push(String.fromCharCode(...data.subarray(i, i + CHUNK)));
  }
  return btoa(parts.join(''));
}

/**
 * Convert base64 string back to Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
