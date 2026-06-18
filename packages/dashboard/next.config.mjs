/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_ORACLE_URL: process.env.NEXT_PUBLIC_ORACLE_URL || "http://localhost:3001",
  },
};

export default nextConfig;