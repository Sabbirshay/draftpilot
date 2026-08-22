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
};

module.exports = nextConfig;
