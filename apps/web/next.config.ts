import type { NextConfig } from "next";

const nextConfig: NextConfig =
  process.env.POLYHUNTER_DOCKER_DEV === "1"
    ? {
        allowedDevOrigins: ["127.0.0.1"],
        webpack(config, { dev }) {
          if (dev) {
            config.watchOptions = {
              ...config.watchOptions,
              poll: 1000,
            };
          }

          return config;
        },
      }
    : {};

export default nextConfig;
