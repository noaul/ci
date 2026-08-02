import type { NextConfig } from "next";

const config: NextConfig = {
  // Fully static: ~4,400 pages rendered at build time, no server at runtime.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default config;
