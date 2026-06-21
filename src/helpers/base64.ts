// Base64-encode UTF-8 text using web-standard APIs (`TextEncoder` + `btoa`), which
// are available on both runtimes the library targets (Node ≥ 22 and browsers). The
// UTF-8 → binary-string round-trip keeps non-ASCII input correct, since `btoa`
// itself only accepts Latin-1.

export function toBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
