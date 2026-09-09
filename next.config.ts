import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    if (process.env.NODE_ENV === 'production') {
      return [
        {
          source: '/api/test/:path*',
          destination: '/api/not-found',
        },
      ]
    }
    return []
  },
};

export default nextConfig;
