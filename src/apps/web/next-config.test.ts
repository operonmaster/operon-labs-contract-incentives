import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("web dev server config", () => {
  it("allows the 127.0.0.1 dev origin used for local browser previews", () => {
    expect(nextConfig.allowedDevOrigins).toContain("127.0.0.1");
  });

  it("emits standalone server output for Cloud Run container deployment", () => {
    expect(nextConfig.output).toBe("standalone");
    expect(nextConfig.outputFileTracingRoot).toMatch(/operon-labs-contract-incentives$/);
  });

  it("sets baseline HTTP security headers for every route", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);

    const headerRules = await nextConfig.headers?.();
    const allRoutesRule = headerRules?.find((rule) => rule.source === "/:path*");
    const headers = Object.fromEntries((allRoutesRule?.headers ?? []).map((header) => [header.key, header.value]));

    expect(headers).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    });
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["Content-Security-Policy"]).toContain("object-src 'none'");
  });
});
