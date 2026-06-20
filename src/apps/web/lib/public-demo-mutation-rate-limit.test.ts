import { afterEach, describe, expect, it } from "vitest";
import {
  enforcePublicDemoMutationRateLimit,
  resetPublicDemoMutationRateLimitForTests,
  setPublicDemoMutationRateLimitEnabledForTests
} from "./public-demo-mutation-rate-limit";

afterEach(() => {
  resetPublicDemoMutationRateLimitForTests();
});

describe("public demo mutation rate limit", () => {
  it("limits a client to one accepted mutation per second", async () => {
    setPublicDemoMutationRateLimitEnabledForTests(true);
    const request = new Request("http://localhost/api/um/prior-auths", {
      headers: { "x-forwarded-for": "203.0.113.7" },
      method: "POST"
    });

    expect(enforcePublicDemoMutationRateLimit(request, { nowMs: 1_000 })).toBeNull();
    const blocked = enforcePublicDemoMutationRateLimit(request, { nowMs: 1_500 });

    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toBe("1");
    await expect(blocked?.json()).resolves.toMatchObject({
      error: "PUBLIC_DEMO_MUTATION_RATE_LIMITED",
      retryAfterSeconds: 1
    });
    expect(enforcePublicDemoMutationRateLimit(request, { nowMs: 2_001 })).toBeNull();
  });

  it("limits a client to ten accepted mutations per minute", () => {
    setPublicDemoMutationRateLimitEnabledForTests(true);
    const request = new Request("http://localhost/api/appeals/cases/APL-1/packet", {
      headers: { "x-forwarded-for": "198.51.100.4" },
      method: "POST"
    });

    for (let index = 0; index < 10; index += 1) {
      expect(enforcePublicDemoMutationRateLimit(request, { nowMs: index * 1_001 })).toBeNull();
    }

    const blocked = enforcePublicDemoMutationRateLimit(request, { nowMs: 10_010 });

    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toBe("50");
  });

  it("uses the first forwarded client address as the limiting key", () => {
    setPublicDemoMutationRateLimitEnabledForTests(true);
    const firstClient = new Request("http://localhost/api/specialty-rx/cases/PA-1/intake", {
      headers: { "x-forwarded-for": "203.0.113.8, 10.0.0.1" },
      method: "POST"
    });
    const sameClient = new Request("http://localhost/api/specialty-rx/cases/PA-2/intake", {
      headers: { "x-forwarded-for": "203.0.113.8, 10.0.0.2" },
      method: "POST"
    });
    const differentClient = new Request("http://localhost/api/specialty-rx/cases/PA-3/intake", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.3" },
      method: "POST"
    });

    expect(enforcePublicDemoMutationRateLimit(firstClient, { nowMs: 2_000 })).toBeNull();
    expect(enforcePublicDemoMutationRateLimit(sameClient, { nowMs: 2_100 })?.status).toBe(429);
    expect(enforcePublicDemoMutationRateLimit(differentClient, { nowMs: 2_100 })).toBeNull();
  });
});
