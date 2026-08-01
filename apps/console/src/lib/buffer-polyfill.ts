import { Buffer } from "buffer";

// @solana/web3.js and friends assume a Node-like `Buffer` global. Turbopack
// (Next.js 16's default dev/build bundler) doesn't support webpack's
// ProvidePlugin, so this is wired up as a plain runtime polyfill instead —
// imported first thing in the root layout, before anything that might touch
// `Buffer` at module-eval time.
if (typeof window !== "undefined" && !window.Buffer) {
  window.Buffer = Buffer;
}

declare global {
  interface Window {
    Buffer: typeof Buffer;
  }
}
