import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  rewrites: async () => ({
    beforeFiles: [
      { source: '/dossiers/:path*', destination: '/case_files/:path*' }
    ]
  })
};

export default nextConfig;
