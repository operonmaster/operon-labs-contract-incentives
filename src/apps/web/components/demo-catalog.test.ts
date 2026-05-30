import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { demoScenarios, getScenario } from "./demo-catalog";

describe("demo catalog", () => {
  it("puts the provider documentation use case first on the home page", () => {
    expect(demoScenarios[0]?.slug).toBe("provider-documentation");
  });

  it("marks implemented home page use cases as active", () => {
    const homePage = readFileSync(path.join(process.cwd(), "src/apps/web/app/page.tsx"), "utf8");
    const styles = readFileSync(path.join(process.cwd(), "src/apps/web/app/styles.css"), "utf8");

    expect(demoScenarios.map((scenario) => scenario.slug)).toEqual([
      "provider-documentation",
      "delegate-um",
      "specialty-rx",
      "appeals"
    ]);
    expect(demoScenarios.find((scenario) => scenario.slug === "specialty-rx")).toMatchObject({
      title: "Specialty Rx Fulfillment SLA",
      submitter: "Specialty pharmacy",
      evaluationType: "specialty_rx_fulfillment_sla",
      status: "active"
    });
    expect(demoScenarios.some((scenario) => scenario.slug === "provider-directory")).toBe(false);
    expect(demoScenarios.find((scenario) => scenario.slug === "provider-documentation")?.status).toBe("active");
    expect(demoScenarios.find((scenario) => scenario.slug === "delegate-um")?.status).toBe("active");
    const appeals = getScenario("appeals");
    expect(appeals.status).toBe("active");
    expect(appeals.title).toBe("Appeals Packet Quality");
    expect(demoScenarios.filter((scenario) => scenario.status === "dormant").map((scenario) => scenario.slug)).toEqual([]);
    expect(homePage).toContain('{scenario.status === "dormant" ? <em>Dormant</em> : null}');
    expect(styles).toContain(".card > em");
    expect(styles).toMatch(/\.card > em \{[^}]*color: var\(--op-amber-2\);/);
  });

  it("labels the homepage for the Hedera AI Agent Bounty Campaign", () => {
    const homePage = readFileSync(path.join(process.cwd(), "src/apps/web/app/page.tsx"), "utf8");

    expect(homePage).toContain('meta="Hedera AI Agent Bounty Campaign"');
    expect(homePage).not.toMatch(/hackat(h)?on/i);
  });

  it("keeps Firestore-backed demo policy pages dynamically rendered", () => {
    for (const route of ["delegate-um", "appeals"]) {
      const source = readFileSync(path.join(process.cwd(), "src/apps/web/app", route, "page.tsx"), "utf8");

      expect(source).toContain('export const dynamic = "force-dynamic"');
    }
  });
});
