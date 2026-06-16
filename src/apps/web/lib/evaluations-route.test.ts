import { describe, expect, it } from "vitest";
import { POST as evaluateDemo } from "../app/api/evaluations/route";

describe("evaluations API route", () => {
  it("keeps the default delegate UM evaluation aligned with the pharmacy demo scenario", async () => {
    const response = await evaluateDemo(
      new Request("http://localhost/api/evaluations", {
        method: "POST",
        body: JSON.stringify({})
      })
    );
    const payload = (await response.json()) as {
      request: {
        requestObject: {
          requestType: string;
        };
      };
      result: {
        decision: string;
        reasonCodes: string[];
      };
      policy: {
        policyId: string;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.request.requestObject.requestType).toBe("pharmacy_benefit");
    expect(payload.policy.policyId).toBe("delegate-um-sla-bonus-v1");
    expect(payload.result).toMatchObject({
      decision: "approved",
      reasonCodes: []
    });
  });
});
