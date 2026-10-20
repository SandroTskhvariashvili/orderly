import type { NextConfig } from "next";

const config: NextConfig = {
  output: "export",
  transpilePackages: ["@orderly/ui"],
  images: { unoptimized: true },
};

export default config;
