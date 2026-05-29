import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("specialty rx API routes", () => {
  it("uses specialty rx workflow APIs instead of generic payment routes", () => {
    const route = readFileSync(
      path.join(
        process.cwd(),
        "src/apps/web/app/api/specialty-rx/cases/[fulfillmentCaseId]/fulfillment/route.ts"
      ),
      "utf8"
    );

    expect(route).toContain("specialtyRxWorkflow.confirmFulfillment");
    expect(route).not.toContain("/api/payments/approve");
  });
});
