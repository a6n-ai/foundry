const ALPHABET = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O for legibility

// Web Crypto, not node:crypto: this barrel reaches client bundles.
function unbiasedIndex(max: number): number {
  const limit = 256 - (256 % max);
  for (;;) {
    const b = globalThis.crypto.getRandomValues(new Uint8Array(1))[0]!;
    if (b < limit) return b % max;
  }
}

export function generateCode(prefix: string, length = 4): string {
  let body = "";
  for (let i = 0; i < length; i++) {
    body += ALPHABET[unbiasedIndex(ALPHABET.length)]!;
  }
  return `${prefix}-${body}`;
}
