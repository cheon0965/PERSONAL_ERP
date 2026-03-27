/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_ENABLE_DEMO_FALLBACK: process.env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK
  }
};

export default nextConfig;
