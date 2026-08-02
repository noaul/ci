import type { NextConfig } from "next";
import { resolve } from "node:path";

const projectRoot = resolve(".");

const config: NextConfig = {
  // Fully static: ~4,400 pages rendered at build time, no server at runtime.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  outputFileTracingRoot: projectRoot,
  turbopack: { root: projectRoot },
};

export default config;
