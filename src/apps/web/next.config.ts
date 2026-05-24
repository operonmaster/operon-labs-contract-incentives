import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
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
