import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.41.25', 'localhost', 'localhost:3108', '192.168.41.25:3108']
};

export default nextConfig;
