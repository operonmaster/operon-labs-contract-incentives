import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  googleAnalyticsMeasurementId,
  googleTagManagerId,
  isAnalyticsHostnameEnabled,
  pageMetadata,
  siteMetadata
} from "./site-seo";

describe("site SEO and analytics metadata", () => {
  it("reuses the Operon Labs Google Analytics and Tag Manager IDs", () => {
    expect(googleAnalyticsMeasurementId).toBe("G-HZ4JMN1767");
    expect(googleTagManagerId).toBe("GTM-NQRNTTPT");
  });

  it("keeps analytics off for local development hosts", () => {
    expect(isAnalyticsHostnameEnabled("contract-incentives.demo.labs.operon.cloud")).toBe(true);
    expect(isAnalyticsHostnameEnabled("localhost")).toBe(false);
    expect(isAnalyticsHostnameEnabled("127.0.0.1")).toBe(false);
    expect(isAnalyticsHostnameEnabled("local.contract-incentives.dev.operon.cloud")).toBe(false);
    expect(isAnalyticsHostnameEnabled("preview.local")).toBe(false);
  });

  it("defines route-specific metadata for every public demo surface", () => {
    expect(siteMetadata.title).toBe("Operon Contract Incentives");
    expect(siteMetadata.url).toBe("https://contract-incentives.demo.labs.operon.cloud");

    expect(Object.keys(pageMetadata).sort()).toEqual(
      [
        "/",
        "/appeals",
        "/appeals/plan",
        "/appeals/policies",
        "/delegate-um",
        "/delegate-um/plan",
        "/delegate-um/policies",
        "/provider-documentation",
        "/provider-documentation/incentives",
        "/provider-documentation/policies",
        "/specialty-rx",
        "/specialty-rx/plan",
        "/specialty-rx/policies"
      ].sort()
    );

    for (const metadata of Object.values(pageMetadata)) {
      expect(metadata.title).toMatch(/Operon Contract Incentives|Provider|Delegate|Specialty|Appeals|Policy|Plan/);
      expect(metadata.description.length).toBeGreaterThan(70);
      expect(metadata.description).toMatch(/policy|contract|incentive|Hedera|settlement|prior authorization/i);
    }
  });

  it("wires analytics and shared route metadata into the app routes", () => {
    const appRoot = resolve(process.cwd(), "src/apps/web/app");
    const layoutSource = readFileSync(resolve(appRoot, "layout.tsx"), "utf8");

    expect(layoutSource).toContain("AnalyticsScripts");

    const routeFiles = [
      "page.tsx",
      "appeals/page.tsx",
      "appeals/plan/page.tsx",
      "appeals/policies/page.tsx",
      "delegate-um/page.tsx",
      "delegate-um/plan/page.tsx",
      "delegate-um/policies/page.tsx",
      "provider-documentation/page.tsx",
      "provider-documentation/incentives/page.tsx",
      "provider-documentation/policies/page.tsx",
      "specialty-rx/page.tsx",
      "specialty-rx/plan/page.tsx",
      "specialty-rx/policies/page.tsx"
    ];

    for (const routeFile of routeFiles) {
      const source = readFileSync(resolve(appRoot, routeFile), "utf8");
      expect(source).toContain("buildPageMetadata");
      expect(source).toContain("export const metadata");
    }
  });
});
