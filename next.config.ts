import type { NextConfig } from "next";

const isCapacitor = process.env.CAPACITOR_BUILD === 'true';

const nextConfig: NextConfig = {
  output: isCapacitor ? 'export' : undefined,
  async rewrites() {
    if (isCapacitor) return [];
    return [
      {
        source: '/api/pb/:path*',
        destination: 'http://157.230.7.89/:path*',
      },
    ];
  },
  /* config options here */
};

export default nextConfig;
