// Type bindings available to every route via `getRequestContext().env`
// (see src/lib/cf.ts). Keep this in sync with wrangler.toml.
interface CloudflareEnv {
  DB: D1Database;
  AI: Ai;
  AUTH_SECRET?: string;
  AUTH_TRUST_HOST?: string;
}
