import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { demoScenarios } from "./demo-catalog";

describe("demo catalog", () => {
  it("puts the provider documentation use case first on the home page", () => {
    expect(demoScenarios[0]?.slug).toBe("provider-documentation");
  });

  it("keeps Firestore-backed demo policy pages dynamically rendered", () => {
    for (const route of ["delegate-um", "appeals", "provider-directory"]) {
      const source = readFileSync(path.join(process.cwd(), "src/apps/web/app", route, "page.tsx"), "utf8");

      expect(source).toContain('export const dynamic = "force-dynamic"');
    }
  });
});
