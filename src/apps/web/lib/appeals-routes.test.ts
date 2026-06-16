import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { POST as acknowledgePost } from "../app/api/appeals/cases/[appealId]/acknowledge/route";
import { POST as intakePost } from "../app/api/appeals/cases/[appealId]/intake/route";
import { POST as originalDecisionPost } from "../app/api/appeals/cases/[appealId]/original-decision/route";
import { POST as missingInfoPost } from "../app/api/appeals/cases/[appealId]/missing-info/route";
import { POST as packetPost } from "../app/api/appeals/cases/[appealId]/packet/route";
import { POST as evidenceIndexPost } from "../app/api/appeals/cases/[appealId]/evidence-index/route";
import { POST as routeReviewerPost } from "../app/api/appeals/cases/[appealId]/route-reviewer/route";
import type { NextRequest } from "next/server";

function postRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/appeals/cases/APL-1/x", {
    method: "POST",
    body: JSON.stringify(body)
  }) as unknown as NextRequest;
}

const context = { params: Promise.resolve({ appealId: "APL-1" }) };

describe("appeals API routes", () => {
  it("uses appeals workflow APIs instead of generic payment routes", () => {
    const route = readFileSync(
      path.join(process.cwd(), "src/apps/web/app/api/appeals/cases/[appealId]/route-reviewer/route.ts"),
      "utf8"
    );

    expect(route).toContain("appealsWorkflow.routeReviewer");
    expect(route).not.toContain("/api/payments/approve");
  });

  it("rejects malformed step bodies with 400 before reaching the workflow", async () => {
    const cases = [
      { handler: acknowledgePost, expectedError: "INVALID_APPEAL_ACKNOWLEDGEMENT" },
      { handler: intakePost, expectedError: "INVALID_APPEAL_INTAKE" },
      { handler: originalDecisionPost, expectedError: "INVALID_APPEAL_ORIGINAL_DECISION" },
      { handler: missingInfoPost, expectedError: "INVALID_APPEAL_MISSING_INFO" },
      { handler: packetPost, expectedError: "INVALID_APPEAL_PACKET" },
      { handler: evidenceIndexPost, expectedError: "INVALID_APPEAL_EVIDENCE_INDEX" },
      { handler: routeReviewerPost, expectedError: "INVALID_APPEAL_REVIEWER_ROUTING" }
    ];

    for (const { handler, expectedError } of cases) {
      const response = await handler(postRequest({ notAValidField: true }), context);
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: expectedError });
    }
  });
});
