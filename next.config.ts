import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.0.105', 'localhost:3000'],
  async redirects() {
    return [
      {
        source: '/',
        destination: '/login',
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY', // Mencegah Clickjacking (tidak bisa di-embed di iframe)
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff', // Mencegah browser sniffing MIME type
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin', // Kontrol informasi referrer
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload', // Paksa HTTPS (jika deploy)
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()', // Batasi API browser
          },
        ],
      },
    ];
  },
};

export default nextConfig;
