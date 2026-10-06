import type { NextConfig } from "next";

/**
 * The workspace publishes TypeScript source (see the `exports` map in each
 * package's own package.json), never a build output. That is what makes a clean
 * checkout work: nothing at runtime depends on a packages `dist` directory
 * that only exists after someone ran a build locally.
 *
 * The consequence for this app is that Next.js must transpile those workspace
 * sources itself, which `transpilePackages` does for BOTH the dev server and the
 * production build. Without it the bundler would hand the raw `.ts` to the
 * server runtime and fail.
 */
const nextConfig: NextConfig = {
  transpilePackages: [
    "@polyhunter/contracts",
    "@polyhunter/domain",
    "@polyhunter/db",
  ],
  ...(process.env.POLYHUNTER_DOCKER_DEV === "1"
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
    : {}),
};

export default nextConfig;
