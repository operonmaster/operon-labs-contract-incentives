import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
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
    expect(appeals.submitter).toBe("Provider appeals team");
    expect(demoScenarios.filter((scenario) => scenario.status === "dormant").map((scenario) => scenario.slug)).toEqual([]);
    expect(homePage).toContain('{scenario.status === "dormant" ? <em>Dormant</em> : null}');
    expect(styles).toContain(".card > em");
    expect(styles).toMatch(/\.card > em \{[^}]*color: var\(--op-amber-2\);/);
  });

  it("labels the homepage for the Hedera AI Agent Bounty Campaign", () => {
    const homePage = readFileSync(path.join(process.cwd(), "src/apps/web/app/page.tsx"), "utf8");

    expect(homePage).toContain("Hedera AI Agent Bounty Campaign");
    expect(homePage).not.toMatch(/hackat(h)?on/i);
  });

  it("frames the homepage around policy-based incentive use cases instead of testnet plumbing", () => {
    const homePage = readFileSync(path.join(process.cwd(), "src/apps/web/app/page.tsx"), "utf8");
    const styles = readFileSync(path.join(process.cwd(), "src/apps/web/app/styles.css"), "utf8");

    expect(homePage).toContain('title="Policy-driven incentives for measurable healthcare operations"');
    expect(homePage).not.toContain("Policy-driven incentives for measurable healthcare operations.");
    expect(homePage).toContain("The demo use cases below show how healthcare teams can earn contract incentives");
    expect(homePage).not.toContain("These use cases show");
    expect(homePage).toContain("Business policies decide whether work qualifies.");
    expect(homePage).toContain("Payment policies enforce financial controls");
    expect(homePage).toContain('title="Incentive use cases"');
    expect(homePage).toContain('meta="Evidence -> business policy -> payment control -> audit"');
    expect(homePage).not.toContain("testnet payments");
    expect(styles).toMatch(/\.home-page \.op-hero h1 \{[^}]*max-width: none;/);
    expect(styles).toMatch(/\.home-page \.op-hero-copy,\s*\.home-page \.op-hero-copy p \{[^}]*max-width: none;/);
    expect(styles).toMatch(/\.op-hero h1,\s*\.hero h1 \{[^}]*max-width: 1020px;/);
    expect(styles).toMatch(/\.op-hero-copy,\s*\.hero p,\s*\.op-hero-copy p \{[^}]*max-width: 820px;/);
  });

  it("does not ship the retired Labs website routes in this demo repo", () => {
    expect(existsSync(path.join(process.cwd(), "src/apps/web/app/labs"))).toBe(false);
    expect(existsSync(path.join(process.cwd(), "src/apps/web/app/labs_v2"))).toBe(false);
    expect(existsSync(path.join(process.cwd(), "src/apps/web/components/labs-site"))).toBe(false);
  });

  it("keeps Firestore-backed demo policy pages dynamically rendered", () => {
    for (const route of ["delegate-um", "appeals"]) {
      const source = readFileSync(path.join(process.cwd(), "src/apps/web/app", route, "page.tsx"), "utf8");

      expect(source).toContain('export const dynamic = "force-dynamic"');
    }
  });

  it("wires the appeals policy catalog page to the appeals business policy store query", () => {
    const source = readFileSync(path.join(process.cwd(), "src/apps/web/app/appeals/policies/page.tsx"), "utf8");

    expect(source).toContain('export const dynamic = "force-dynamic"');
    expect(source).toContain("policyStore.listPolicies");
    expect(source).toContain("appeals_packet_quality");
  });
});
