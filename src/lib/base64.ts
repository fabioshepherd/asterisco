/** Encode bytes as base64 (e.g. to inline a font as a `data:` URL).
 * Chunked so large files don't blow the argument limit of String.fromCharCode. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
