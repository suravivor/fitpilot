// Thin wrapper around @cloudflare/next-on-pages' getRequestContext, so the
// rest of the app imports bindings from one place instead of the package
// directly. Keeping this isolated also makes it easy to stub in tests.
import { getRequestContext } from "@cloudflare/next-on-pages";

export function getEnv(): CloudflareEnv {
  return getRequestContext().env as unknown as CloudflareEnv;
}

export function getDb(): D1Database {
  return getEnv().DB;
}

export function getAi(): Ai {
  return getEnv().AI;
}
