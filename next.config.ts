import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Allow an isolated build output (e.g. the Playwright e2e server) so it never
  // clobbers a running `next dev` `.next` directory. Defaults to `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  rewrites: async () => ({
    beforeFiles: [{ source: "/dossiers/:path*", destination: "/case_files/:path*" }],
  }),
};

export default nextConfig;
