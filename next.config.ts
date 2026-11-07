import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lib/news.ts lee NEWS.md en runtime: se incluye explícito en el bundle del deploy.
  // getTeamLogos (lib/data/images.ts) chequea con fs que exista public/teams/<logo>.
  outputFileTracingIncludes: { '/': ['./NEWS.md', './public/teams/**'] },
};

export default nextConfig;
