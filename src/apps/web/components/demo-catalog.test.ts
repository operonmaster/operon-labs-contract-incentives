import { describe, expect, it } from "vitest";
import { demoScenarios } from "./demo-catalog";

describe("demo catalog", () => {
  it("puts the provider documentation use case first on the home page", () => {
    expect(demoScenarios[0]?.slug).toBe("provider-documentation");
  });
});
