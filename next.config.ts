import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lib/news.ts lee NEWS.md en runtime: se incluye explícito en el bundle del deploy
  outputFileTracingIncludes: { '/': ['./NEWS.md'] },
};

export default nextConfig;
