import { NextResponse } from "next/server";

const BURST_WINDOW_MS = 1_000;
const BURST_LIMIT = 1;
const SUSTAINED_WINDOW_MS = 60_000;
const SUSTAINED_LIMIT = 10;
const RATE_LIMIT_ERROR = "PUBLIC_DEMO_MUTATION_RATE_LIMITED";
let testRateLimitOverride: boolean | null = null;

interface MutationBucket {
  timestamps: number[];
}

interface RateLimitOptions {
  nowMs?: number;
}

// Process-local guard for public demo abuse control; use a shared external store if hard global limits are required.
const mutationBuckets = new Map<string, MutationBucket>();

export function enforcePublicDemoMutationRateLimit(request: Request, options: RateLimitOptions = {}): NextResponse | null {
  if (!isRateLimitEnabled()) {
    return null;
  }

  const nowMs = options.nowMs ?? Date.now();
  const clientKey = getClientKey(request);
  const bucket = mutationBuckets.get(clientKey) ?? { timestamps: [] };
  const recentTimestamps = bucket.timestamps.filter((timestamp) => nowMs - timestamp < SUSTAINED_WINDOW_MS);
  const burstCount = recentTimestamps.filter((timestamp) => nowMs - timestamp < BURST_WINDOW_MS).length;

  if (burstCount >= BURST_LIMIT || recentTimestamps.length >= SUSTAINED_LIMIT) {
    const retryAfterSeconds = calculateRetryAfterSeconds(nowMs, recentTimestamps, burstCount >= BURST_LIMIT);

    bucket.timestamps = recentTimestamps;
    mutationBuckets.set(clientKey, bucket);

    return NextResponse.json(
      {
        error: RATE_LIMIT_ERROR,
        retryAfterSeconds
      },
      {
        headers: { "Retry-After": String(retryAfterSeconds) },
        status: 429
      }
    );
  }

  bucket.timestamps = [...recentTimestamps, nowMs];
  mutationBuckets.set(clientKey, bucket);
  return null;
}

export function resetPublicDemoMutationRateLimitForTests(): void {
  mutationBuckets.clear();
  testRateLimitOverride = null;
}

export function setPublicDemoMutationRateLimitEnabledForTests(enabled: boolean): void {
  testRateLimitOverride = enabled;
}

function isRateLimitEnabled(): boolean {
  if (testRateLimitOverride !== null) {
    return testRateLimitOverride;
  }

  const mode = process.env.PUBLIC_DEMO_MUTATION_RATE_LIMIT?.trim().toLowerCase();

  if (mode === "disabled" || mode === "false" || mode === "off") {
    return false;
  }

  if (process.env.NODE_ENV === "test" && mode !== "enabled" && mode !== "true") {
    return false;
  }

  return true;
}

function getClientKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();

  return forwardedFor || realIp || cloudflareIp || "anonymous";
}

function calculateRetryAfterSeconds(nowMs: number, timestamps: number[], burstLimited: boolean): number {
  const retryAfterMs = Math.max(
    burstLimited && timestamps.length > 0 ? BURST_WINDOW_MS - (nowMs - timestamps[timestamps.length - 1]!) : 0,
    timestamps.length >= SUSTAINED_LIMIT ? SUSTAINED_WINDOW_MS - (nowMs - timestamps[0]!) : 0
  );

  return Math.max(1, Math.ceil(retryAfterMs / 1_000));
}
