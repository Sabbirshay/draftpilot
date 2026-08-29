/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native Vercel optimization
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://amjliubpbysvtiqpbgnh.supabase.co wss://amjliubpbysvtiqpbgnh.supabase.co https://openrouter.ai https://api.openrouter.ai;",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
