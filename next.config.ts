import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: [
        '@opentelemetry/instrumentation',
        '@opentelemetry/sdk-node',
        'require-in-the-middle',
        'handlebars',
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
          protocol: 'https',
          hostname: 'source.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
