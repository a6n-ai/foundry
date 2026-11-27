import { customAlphabet } from "nanoid";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-";
const nano = customAlphabet(ALPHABET, 12);

export function makePublicId(prefix: string): () => string {
  if (!/^[a-z]{3}$/.test(prefix)) {
    throw new Error(`id prefix must be exactly 3 lowercase letters, got "${prefix}"`);
  }
  return () => `${prefix}_${nano()}`;
}

export function newId(prefix: string): string {
  return makePublicId(prefix)();
}
