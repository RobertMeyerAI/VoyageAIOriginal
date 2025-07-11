/** @type {import('next').NextConfig} */
const nextConfig = {
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

module.exports = nextConfig;
