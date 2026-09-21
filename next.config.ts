import type { NextConfig } from "next";

/**
 * `output: "standalone"` emits a self-contained server bundle, which is what
 * the production Docker image ships so it needs no node_modules layer.
 *
 * It is opt-in rather than always on, because `next start` refuses to serve a
 * standalone build: the standalone server must be launched directly, with
 * .next/static and public copied beside it, which is exactly what the
 * Dockerfile runner stage does. Leaving it on unconditionally silently breaks
 * `npm run build && npm run start` locally — every route 404s while the build
 * output still lists them.
 */
const standalone = process.env["BUILD_STANDALONE"] === "1";

const nextConfig: NextConfig = {
  ...(standalone ? { output: "standalone" as const } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
