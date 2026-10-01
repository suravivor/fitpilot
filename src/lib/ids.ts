import { customAlphabet } from "nanoid";

// Lowercase alphanumeric, no ambiguous chars — fine for URLs and D1 primary keys.
const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const nano = customAlphabet(alphabet, 21);

export function newId(prefix: string): string {
  return `${prefix}_${nano()}`;
}
