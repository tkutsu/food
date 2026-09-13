import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No server: the map is client-rendered and every price series is baked
  // into public/data by scripts/build-data.ts.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
