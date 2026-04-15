/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',       // Requerido para Dockerfile multi-stage
  transpilePackages: ['@sgci/shared'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.daily.co' },
      { protocol: 'http',  hostname: 'localhost' },
    ],
  },
  async redirects() {
    return [
      { source: '/', destination: '/dashboard', permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'X-Frame-Options',            value: 'DENY' },
          { key: 'X-XSS-Protection',           value: '1; mode=block' },
          { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',         value: 'camera=(self), microphone=(self)' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
