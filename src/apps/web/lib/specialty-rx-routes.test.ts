import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { POST as intakePost } from "../app/api/specialty-rx/cases/[fulfillmentCaseId]/intake/route";
import { POST as clearToFillPost } from "../app/api/specialty-rx/cases/[fulfillmentCaseId]/clear-to-fill/route";
import { POST as shipmentPost } from "../app/api/specialty-rx/cases/[fulfillmentCaseId]/shipment/route";
import { POST as fulfillmentPost } from "../app/api/specialty-rx/cases/[fulfillmentCaseId]/fulfillment/route";
import type { NextRequest } from "next/server";

function postRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/specialty-rx/cases/PA-1/x", {
    method: "POST",
    body: JSON.stringify(body)
  }) as unknown as NextRequest;
}

const context = { params: Promise.resolve({ fulfillmentCaseId: "PA-1" }) };

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

  it("rejects malformed step bodies with 400 before reaching the workflow", async () => {
    const cases = [
      { handler: intakePost, expectedError: "INVALID_INTAKE" },
      { handler: clearToFillPost, expectedError: "INVALID_CLEAR_TO_FILL" },
      { handler: shipmentPost, expectedError: "INVALID_SHIPMENT" },
      { handler: fulfillmentPost, expectedError: "INVALID_FULFILLMENT" }
    ];

    for (const { handler, expectedError } of cases) {
      const response = await handler(postRequest({ notAValidField: true }), context);
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: expectedError });
    }
  });

  it("rejects a shipment body that smuggles non-input fields", async () => {
    const response = await shipmentPost(
      postRequest({
        patientContactAttemptDocumented: true,
        addressConfirmed: true,
        deliveryWindowConfirmed: true,
        coldChainPackoutValidated: true,
        courierScheduled: "yes",
        coldChainRequired: false
      }),
      context
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_SHIPMENT" });
  });
});
