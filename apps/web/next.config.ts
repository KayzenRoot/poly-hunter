import type { NextConfig } from "next";

const nextConfig: NextConfig =
  process.env.POLYHUNTER_DOCKER_DEV === "1"
    ? {
        allowedDevOrigins: ["127.0.0.1"],
        watchOptions: { pollIntervalMs: 1000 },
      }
    : {};

export default nextConfig;
