import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { AppealsWorkflowModal } from "./AppealsWorkflowModal";
import type { AppealCase } from "../../lib/appeals-store";

describe("AppealsConsole", () => {
  it("loads appeal prior-auth rows through the shared worklist hook", () => {
    const source = readFileSync(path.join(process.cwd(), "src/apps/web/components/appeals/AppealsConsole.tsx"), "utf8");

    expect(source).toContain('endpoint: "/api/appeals/prior-auths"');
    expect(source).toContain("getRowId: (row) => row.umRequestId");
    expect(source).toContain("Start appeal");
    expect(source).toContain("Open appeal");
  });

  it("renders the provider appeal workflow steps", () => {
    const markup = renderToStaticMarkup(
      createElement(AppealsWorkflowModal, {
        appealCase: buildAppealCase(),
        onClose: () => undefined,
        onUpdated: () => undefined
      })
    );

    expect(markup).toContain("Acknowledge Receipt");
    expect(markup).toContain("Validate Intake");
    expect(markup).toContain("Retrieve Original PA Decision");
    expect(markup).toContain("Resolve Missing Info");
    expect(markup).toContain("Assemble Packet");
    expect(markup).toContain("Index Evidence");
    expect(markup).toContain("Route Reviewer");
  });
});

function buildAppealCase(): AppealCase {
  return {
    id: "APL-260526-0900-DENIED01",
    umRequestId: "PA-260526-0900-DENIED01",
    source: "provider_started_from_denied_pa",
    planId: "acme-health-ppo",
    providerId: "lakeside-provider-admin",
    submitterId: "lakeside-provider-admin",
    requestType: "pharmacy_benefit",
    serviceCode: "humira_adalimumab",
    serviceLabel: "Humira (adalimumab)",
    originalOutcomeStatus: "denied",
    originalDenialReasonCode: "PLAN_CRITERIA_NOT_MET",
    state: "created",
    appealReceivedAt: "2026-06-18T16:00:00.000Z",
    acknowledgedAt: null,
    packetReadyAt: null,
    packetReadinessSlaHours: 24,
    acknowledgementSlaBusinessHours: 2,
    expedited: false,
    intake: { appealRequestPresent: false, appellantAuthorized: false, planMemberMatched: false, requestedServiceMatched: false },
    originalDecision: { denialReasonRetrieved: false, priorDecisionSummaryIncluded: false, coveragePolicyLocated: false },
    missingInfo: { missingInfoRequired: false, missingInfoRequested: false, missingInfoResolved: true },
    packet: { requiredDocumentsPresent: false, clinicalRationaleIncluded: false, policyCitationIncluded: false, evidenceIndexComplete: false, qualityAuditPassed: false, noReworkRequired: false },
    routing: { reviewerQueueSelected: false, reviewerConflictCheckComplete: false, finalDecisionOutsideIncentive: true },
    updatedAt: "2026-06-18T16:00:00.000Z"
  };
}
