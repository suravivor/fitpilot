/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["bcryptjs"],
  },
};

export default nextConfig;

// Enables `wrangler pages dev` / `getRequestContext()` to work in local dev
// alongside `next dev`, per @cloudflare/next-on-pages setup.
if (process.env.NODE_ENV === "development") {
  const { setupDevPlatform } = await import("@cloudflare/next-on-pages/next-dev");
  await setupDevPlatform();
}
