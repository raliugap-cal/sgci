/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',       // Requerido para Dockerfile multi-stage
  async redirects() {
    return [
      { source: '/', destination: '/dashboard', permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control',       value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type',        value: 'application/javascript; charset=utf-8' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options',        value: 'DENY' },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
