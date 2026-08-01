import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer, webpack }) => {
    // @solana/web3.js and friends assume a Node-like Buffer global; webpack 5
    // no longer polyfills Node core modules automatically, so wire it up
    // explicitly for the client bundle only.
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, buffer: require.resolve("buffer/") };
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ["buffer", "Buffer"],
        })
      );
    }
    return config;
  },
};

export default nextConfig;
