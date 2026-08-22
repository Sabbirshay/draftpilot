/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native Vercel optimization
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),
};

module.exports = nextConfig;
