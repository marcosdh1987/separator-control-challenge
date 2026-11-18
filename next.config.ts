import type { NextConfig } from "next";

/**
 * The simulator has no server code: every route is prerendered and the physics runs
 * in the browser. It can therefore be published either as a normal Next.js app or as
 * plain static files.
 *
 * Static export is opt-in rather than the default, because it also disables the
 * development conveniences the local workflow relies on. To build files for a static
 * host:
 *
 *     STATIC_EXPORT=1 npm run build
 *
 * When serving from a subdirectory — a project page on GitHub Pages, for instance —
 * also set the path it will live under:
 *
 *     STATIC_EXPORT=1 BASE_PATH=/separator-control-challenge npm run build
 */
const staticExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The Research Lab fetches its static data files at run time and needs the
  // same base path as the pages when the site is served from a subfolder.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  ...(staticExport
    ? {
        output: "export",
        // A static host has no request-time image optimiser to call.
        images: { unoptimized: true },
        // Serve /training as /training/index.html rather than relying on host rewrites.
        trailingSlash: true,
        ...(basePath ? { basePath, assetPrefix: basePath } : {}),
      }
    : {}),
};

export default nextConfig;
