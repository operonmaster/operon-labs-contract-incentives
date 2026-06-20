import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { POST as submitPriorAuth } from "../app/api/um/prior-auths/route";
import {
  resetPublicDemoMutationRateLimitForTests,
  setPublicDemoMutationRateLimitEnabledForTests
} from "./public-demo-mutation-rate-limit";

const guardedMutationRoutes = [
  "src/apps/web/app/api/appeals/cases/route.ts",
  "src/apps/web/app/api/appeals/cases/[appealId]/acknowledge/route.ts",
  "src/apps/web/app/api/appeals/cases/[appealId]/evidence-index/route.ts",
  "src/apps/web/app/api/appeals/cases/[appealId]/intake/route.ts",
  "src/apps/web/app/api/appeals/cases/[appealId]/missing-info/route.ts",
  "src/apps/web/app/api/appeals/cases/[appealId]/original-decision/route.ts",
  "src/apps/web/app/api/appeals/cases/[appealId]/packet/route.ts",
  "src/apps/web/app/api/appeals/cases/[appealId]/route-reviewer/route.ts",
  "src/apps/web/app/api/delegate-um/requests/[umRequestId]/determination/route.ts",
  "src/apps/web/app/api/delegate-um/requests/[umRequestId]/start-review/route.ts",
  "src/apps/web/app/api/specialty-rx/cases/[fulfillmentCaseId]/clear-to-fill/route.ts",
  "src/apps/web/app/api/specialty-rx/cases/[fulfillmentCaseId]/fulfillment/route.ts",
  "src/apps/web/app/api/specialty-rx/cases/[fulfillmentCaseId]/intake/route.ts",
  "src/apps/web/app/api/specialty-rx/cases/[fulfillmentCaseId]/shipment/route.ts",
  "src/apps/web/app/api/um/prior-auths/route.ts"
];

afterEach(() => {
  resetPublicDemoMutationRateLimitForTests();
});

describe("public demo mutation route rate limit", () => {
  it("rate limits repeated valid create requests from the same client", async () => {
    setPublicDemoMutationRateLimitEnabledForTests(true);
    const first = await submitPriorAuth(buildPriorAuthRequest("203.0.113.77"));
    const second = await submitPriorAuth(buildPriorAuthRequest("203.0.113.77"));

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    await expect(second.json()).resolves.toMatchObject({
      error: "PUBLIC_DEMO_MUTATION_RATE_LIMITED"
    });
  });

  it("keeps malformed requests on validation errors instead of spending the rate-limit budget", async () => {
    setPublicDemoMutationRateLimitEnabledForTests(true);
    const invalid = await submitPriorAuth(
      new Request("http://localhost/api/um/prior-auths", {
        headers: { "x-forwarded-for": "203.0.113.88" },
        method: "POST",
        body: JSON.stringify({ invalid: true })
      })
    );
    const valid = await submitPriorAuth(buildPriorAuthRequest("203.0.113.88"));

    expect(invalid.status).toBe(400);
    expect(valid.status).toBe(200);
  });

  it("guards every route that mutates public demo workflow state", () => {
    for (const routePath of guardedMutationRoutes) {
      const route = readFileSync(path.join(process.cwd(), routePath), "utf8");

      expect(route).toContain("enforcePublicDemoMutationRateLimit");
    }
  });
});

function buildPriorAuthRequest(clientIp: string): Request {
  return new Request("http://localhost/api/um/prior-auths", {
    headers: { "x-forwarded-for": clientIp },
    method: "POST",
    body: JSON.stringify({
      patientId: "patient-maya-chen",
      planId: "acme-health-ppo",
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    })
  });
}
