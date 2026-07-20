import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],

  // Compress all responses (Brotli/Gzip)
  compress: true,

  // Add response headers for API routes
  async headers() {
    return [
      {
        // Cache static assets aggressively
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
};

export default nextConfig;
