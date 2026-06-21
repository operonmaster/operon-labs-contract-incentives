import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  output: "standalone",
  outputFileTracingRoot: path.resolve(appDirectory, "../../.."),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          },
          {
            key: "X-Frame-Options",
            value: "DENY"
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload"
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
          },
          {
            key: "Content-Security-Policy",
            value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'"
          }
        ]
      }
    ];
  },
  turbopack: {
    root: path.resolve(appDirectory, "../../..")
  },
  transpilePackages: [
    "@operon-labs/audit-log",
    "@operon-labs/hedera-executor",
    "@operon-labs/incentive-agent",
    "@operon-labs/policy-engine",
    "@operon-labs/um-platform"
  ]
};

export default nextConfig;
