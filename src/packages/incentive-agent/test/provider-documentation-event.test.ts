import { describe, expect, it, vi } from "vitest";
import type { IncentivePolicy } from "@operon-labs/policy-engine";
import { createInMemoryUmPlatform } from "@operon-labs/um-platform";
import type { ProviderDocumentationEvidence } from "@operon-labs/um-platform";
import { evaluateDemoScenario, evaluateProviderDocumentationEvent } from "../src/index";

describe("evaluateProviderDocumentationEvent", () => {
  it("evaluates a demo scenario using the caller supplied pair-specific Firestore policy", () => {
    const policy = createProviderDocumentationPolicy(2);
    const evaluation = evaluateDemoScenario("provider_documentation_completeness", policy);

    expect(evaluation.policy).toBe(policy);
    expect(evaluation.result).toMatchObject({
      decision: "approved",
      amount: 2,
      currency: "HBAR",
      settlementToken: {
        symbol: "HBAR"
      }
    });
  });

  it("uses the caller supplied Firestore policy for provider documentation events", () => {
    const platform = createInMemoryUmPlatform();
    const umRequest = platform.submitPriorAuth({
      planId: "acme-health-ppo",
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const policy = createProviderDocumentationPolicy(2);

    const evaluation = evaluateProviderDocumentationEvent(
      { eventType: "UM_REQUEST_CREATED", umRequestId: umRequest.id },
      { getEvidenceByUmRequestId: platform.getEvidence, policy, monthToDateAmount: 0 }
    );

    expect(evaluation.result).toMatchObject({
      decision: "approved",
      amount: 2,
      currency: "HBAR",
      settlementToken: {
        symbol: "HBAR"
      }
    });
  });

  it("pulls policy-safe evidence by umRequestId and approves complete knee MRI DTR documentation", () => {
    const platform = createInMemoryUmPlatform();
    const umRequest = platform.submitPriorAuth({
      planId: "acme-health-ppo",
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const getEvidence = vi.fn(platform.getEvidence);

    const evaluation = evaluateProviderDocumentationEvent(
      { eventType: "UM_REQUEST_CREATED", umRequestId: umRequest.id },
      { getEvidenceByUmRequestId: getEvidence, policy: createProviderDocumentationPolicy(5), monthToDateAmount: 0 }
    );

    expect(getEvidence).toHaveBeenCalledWith(umRequest.id);
    expect(evaluation.request.requestObject).toMatchObject({
      id: umRequest.id,
      umRequestId: umRequest.id,
      caseId: umRequest.id,
      planId: "acme-health-ppo",
      providerId: "lakeside-provider-admin",
      requestType: "outpatient_service",
      codingSystem: "CPT",
      billingCode: "73721",
      coveredBenefit: true,
      dtrRequested: true,
      dtrCompleted: true,
      dtrTemplateCompleted: true,
      outcomeStatusUsedForPayment: false,
      containsPhi: false
    });
    expect(evaluation.request.requestObject).not.toHaveProperty("outcomeStatus");
    expect(evaluation.request.requestObject).not.toHaveProperty("pasSubmitted");
    expect(evaluation.request.requestObject).not.toHaveProperty("attachmentChecklistComplete");
    expect(evaluation.request.requestObject).not.toHaveProperty("fhirFieldsPresent");
    expect(evaluation.result).toMatchObject({
      decision: "approved",
      amount: 5,
      currency: "HBAR",
      settlementToken: {
        symbol: "HBAR"
      },
      walletId: "0.0.9049549",
      reasonCodes: []
    });
  });

  it("blocks full-body wellness MRI with zero incentive", () => {
    const platform = createInMemoryUmPlatform();
    const umRequest = platform.submitPriorAuth({
      planId: "acme-health-ppo",
      requestType: "outpatient_service",
      serviceCode: "full_body_wellness_mri",
      acknowledgedNotCovered: true
    });

    const evaluation = evaluateProviderDocumentationEvent(
      { eventType: "UM_REQUEST_CREATED", umRequestId: umRequest.id },
      {
        getEvidenceByUmRequestId: platform.getEvidence,
        policy: createProviderDocumentationPolicy(5),
        monthToDateAmount: 0
      }
    );

    expect(evaluation.result).toMatchObject({
      decision: "blocked",
      amount: 0,
      walletId: null,
      reasonCodes: expect.arrayContaining(["SERVICE_CODE_NOT_INCLUDED", "BENEFIT_NOT_COVERED"])
    });
    expect(evaluation.result.reasonCodes).not.toContain("DTR_TEMPLATE_INCOMPLETE");
  });

  it("approves complete pharmacy benefit DTR documentation when the NDC is in scope", () => {
    const platform = createInMemoryUmPlatform();
    const umRequest = platform.submitPriorAuth({
      planId: "acme-health-ppo",
      requestType: "pharmacy_benefit",
      serviceCode: "humira_adalimumab",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });

    const evaluation = evaluateProviderDocumentationEvent(
      { eventType: "UM_REQUEST_CREATED", umRequestId: umRequest.id },
      {
        getEvidenceByUmRequestId: platform.getEvidence,
        policy: createProviderDocumentationPolicy(5, "pharmacy_benefit"),
        monthToDateAmount: 0
      }
    );

    expect(evaluation.request.requestObject).toMatchObject({
      id: umRequest.id,
      umRequestId: umRequest.id,
      caseId: umRequest.id,
      requestType: "pharmacy_benefit",
      billingCode: "0074-0554-02",
      dtrRequested: true,
      dtrCompleted: true,
      dtrTemplateCompleted: true
    });
    expect(evaluation.result).toMatchObject({
      decision: "approved",
      amount: 5,
      reasonCodes: []
    });
  });

  it("rejects non-PAS events before evidence lookup", () => {
    const getEvidence = vi.fn();

    expect(() =>
      evaluateProviderDocumentationEvent(
        { eventType: "PAS_SUBMITTED", umRequestId: "PA-260524-2102-IGNORE99" },
        { getEvidenceByUmRequestId: getEvidence, policy: createProviderDocumentationPolicy(5), monthToDateAmount: 0 }
      )
    ).toThrow("UNSUPPORTED_PROVIDER_DOCUMENTATION_EVENT");
    expect(getEvidence).not.toHaveBeenCalled();
  });

  it("throws when UM request evidence is missing for the umRequestId", () => {
    const getEvidence = vi.fn(() => null);

    const missingUmRequestId = "PA-260524-2102-MISSING1";

    expect(() =>
      evaluateProviderDocumentationEvent(
        { eventType: "UM_REQUEST_CREATED", umRequestId: missingUmRequestId },
        { getEvidenceByUmRequestId: getEvidence, policy: createProviderDocumentationPolicy(5), monthToDateAmount: 0 }
      )
    ).toThrow(`PROVIDER_DOCUMENTATION_EVIDENCE_NOT_FOUND:${missingUmRequestId}`);
    expect(getEvidence).toHaveBeenCalledWith(missingUmRequestId);
  });

  it("treats covered services without requested DTR as not applicable to this policy", () => {
    const evidence = {
      id: "PA-260524-2102-AAAA1111",
      umRequestId: "PA-260524-2102-AAAA1111",
      caseId: "PA-260524-2102-AAAA1111",
      planId: "acme-health-ppo",
      submitter: { id: "lakeside-provider-admin" },
      providerId: "lakeside-provider-admin",
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      codingSystem: "CPT",
      billingCode: "73721",
      coveredBenefit: true,
      dtrRequested: false,
      dtrCompleted: false,
      dtrTemplateCompleted: false
    } as unknown as ProviderDocumentationEvidence;

    const evaluation = evaluateProviderDocumentationEvent(
      { eventType: "UM_REQUEST_CREATED", umRequestId: evidence.umRequestId },
      { getEvidenceByUmRequestId: () => evidence, policy: createProviderDocumentationPolicy(5), monthToDateAmount: 0 }
    );

    expect(evaluation.result).toMatchObject({
      decision: "not_applicable",
      amount: 0,
      walletId: null,
      reasonCodes: ["DTR_NOT_REQUESTED"]
    });
  });

  it("uses canonical dtrCompleted for the policy compatibility DTR field", () => {
    const evidence = {
      id: "PA-260524-2102-DTRCNFL",
      umRequestId: "PA-260524-2102-DTRCNFL",
      caseId: "PA-260524-2102-DTRCNFL",
      planId: "acme-health-ppo",
      submitter: { id: "lakeside-provider-admin" },
      providerId: "lakeside-provider-admin",
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      codingSystem: "CPT",
      billingCode: "73721",
      coveredBenefit: true,
      dtrRequested: true,
      dtrCompleted: false,
      dtrTemplateCompleted: true
    } as unknown as ProviderDocumentationEvidence;

    const evaluation = evaluateProviderDocumentationEvent(
      { eventType: "UM_REQUEST_CREATED", umRequestId: evidence.umRequestId },
      { getEvidenceByUmRequestId: () => evidence, policy: createProviderDocumentationPolicy(5), monthToDateAmount: 0 }
    );

    expect(evaluation.request.requestObject).toMatchObject({
      dtrCompleted: false,
      dtrTemplateCompleted: false
    });
    expect(evaluation.result).toMatchObject({
      decision: "blocked",
      amount: 0,
      walletId: null,
      reasonCodes: ["DTR_TEMPLATE_INCOMPLETE"]
    });
  });
});

function createProviderDocumentationPolicy(
  amount: number,
  requestType: "outpatient_service" | "pharmacy_benefit" = "outpatient_service"
): IncentivePolicy {
  const pharmacy = requestType === "pharmacy_benefit";

  return {
    policyId: pharmacy ? "plcy_2N7P5R8T0V4X6Z1B3D9F" : "plcy_8K2M4Q6R9T1V3X5Z7B0C",
    version: "v1",
    status: "active",
    evaluationType: "provider_documentation_completeness",
    contractPair: {
      planId: "acme-health-ppo",
      planName: "Acme Health PPO",
      providerId: "lakeside-provider-admin",
      providerName: "Lakeside Provider Admin"
    },
    effectivePeriod: {
      startsOn: "2026-05-01",
      endsOn: null
    },
    incentiveScope: {
      eligibleRequestTypes: [requestType],
      includedServiceCodes: {
        cpt: pharmacy ? [] : ["73721"],
        ndc: pharmacy ? ["0169-4525-14", "0074-0554-02"] : []
      }
    },
    eligibilityCriteria: {
      appliesOnlyToCoveredBenefits: true,
      requiresDtrCompletionWhenRequested: true
    },
    payout: {
      token: "HBAR",
      amountPerEligibleRequest: amount,
      monthlyCap: 500
    },
    settlement: {
      mode: "auto",
      recipientWalletId: "0.0.9049549",
      requiresHumanApproval: false
    }
  };
}
