import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { demoScenarios } from "./demo-catalog";

describe("demo catalog", () => {
  it("puts the provider documentation use case first on the home page", () => {
    expect(demoScenarios[0]?.slug).toBe("provider-documentation");
  });

  it("marks implemented home page use cases as active", () => {
    const homePage = readFileSync(path.join(process.cwd(), "src/apps/web/app/page.tsx"), "utf8");
    const styles = readFileSync(path.join(process.cwd(), "src/apps/web/app/styles.css"), "utf8");

    expect(demoScenarios.find((scenario) => scenario.slug === "provider-documentation")?.status).toBe("active");
    expect(demoScenarios.find((scenario) => scenario.slug === "delegate-um")?.status).toBe("active");
    expect(demoScenarios.filter((scenario) => scenario.status === "dormant").map((scenario) => scenario.slug)).toEqual([
      "appeals",
      "provider-directory"
    ]);
    expect(homePage).toContain('{scenario.status === "dormant" ? <em>Dormant</em> : null}');
    expect(styles).toContain(".card > em");
    expect(styles).toMatch(/\.card > em \{[^}]*color: var\(--op-amber-2\);/);
  });

  it("keeps Firestore-backed demo policy pages dynamically rendered", () => {
    for (const route of ["delegate-um", "appeals", "provider-directory"]) {
      const source = readFileSync(path.join(process.cwd(), "src/apps/web/app", route, "page.tsx"), "utf8");

      expect(source).toContain('export const dynamic = "force-dynamic"');
    }
  });
});
