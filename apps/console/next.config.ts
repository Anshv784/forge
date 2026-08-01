import type { NextConfig } from "next";

// No webpack/Turbopack bundler config needed: the Buffer polyfill
// @solana/web3.js needs in the browser is wired up at runtime instead — see
// src/lib/buffer-polyfill.ts — since Turbopack (Next.js 16's default
// bundler) doesn't support webpack's ProvidePlugin.
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Static files served from public/ don't go through our route
        // handlers' own CORS headers, so actions.json needs it set here —
        // Blink-aware clients fetch it directly to discover action routes.
        source: "/actions.json",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },
};

export default nextConfig;
