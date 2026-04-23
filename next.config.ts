import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["100.107.124.95"],
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
