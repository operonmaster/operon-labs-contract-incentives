import { describe, expect, it, vi } from "vitest";
import type { IncentivePolicy } from "@operon-labs/policy-engine";
import { createInMemoryUmPlatform } from "@operon-labs/um-platform";
import type { ProviderDocumentationEvidence } from "@operon-labs/um-platform";
import { evaluateDemoScenario, evaluateProviderDocumentationEvent } from "../src/index";

describe("evaluateProviderDocumentationEvent", () => {
  it("evaluates a demo scenario using the caller supplied Firestore policy", () => {
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
    const priorAuth = platform.submitPriorAuth({
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
      { eventType: "PAS_SUBMITTED", caseId: priorAuth.caseId },
      { getEvidenceByCaseId: platform.getEvidence, policy, monthToDateAmount: 0 }
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

  it("defines every supplied demo policy as a 5 HBAR incentive", () => {
    for (const evaluationType of [
      "delegate_um_sla_bonus",
      "provider_documentation_completeness",
      "appeals_packet_quality",
      "provider_directory_quality"
    ]) {
      const policy = createGenericPolicy(evaluationType);
      const evaluation = evaluateDemoScenario(evaluationType, policy);

      expect(evaluation.policy.paymentFormula).toMatchObject({
        baseAmount: 5,
        maxPerRequest: 5,
        monthlyCap: 500,
        token: {
          symbol: "HBAR"
        }
      });
      expect(evaluation.result).toMatchObject({
        decision: "approved",
        amount: 5,
        currency: "HBAR",
        settlementToken: {
          symbol: "HBAR"
        }
      });
    }
  });

  it("pulls evidence by caseId and approves complete knee MRI documentation", () => {
    const platform = createInMemoryUmPlatform();
    const priorAuth = platform.submitPriorAuth({
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
      { eventType: "PAS_SUBMITTED", caseId: priorAuth.caseId },
      { getEvidenceByCaseId: getEvidence, policy: createProviderDocumentationPolicy(5), monthToDateAmount: 0 }
    );

    expect(getEvidence).toHaveBeenCalledWith(priorAuth.caseId);
    expect(evaluation.request.requestObject).toMatchObject({
      caseId: priorAuth.caseId,
      requestType: "outpatient_service",
      crdCoveredBenefit: true,
      dtrTemplateCompleted: true,
      pasSubmitted: true
    });
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
    expect(evaluation.policy.paymentFormula.token).toMatchObject({
      symbol: "HBAR"
    });
  });

  it("blocks full-body wellness MRI with zero incentive", () => {
    const platform = createInMemoryUmPlatform();
    const priorAuth = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "full_body_wellness_mri",
      acknowledgedNotCovered: true
    });

    const evaluation = evaluateProviderDocumentationEvent(
      { eventType: "PAS_SUBMITTED", caseId: priorAuth.caseId },
      { getEvidenceByCaseId: platform.getEvidence, policy: createProviderDocumentationPolicy(5), monthToDateAmount: 0 }
    );

    expect(evaluation.result).toMatchObject({
      decision: "blocked",
      amount: 0,
      walletId: null,
      reasonCodes: expect.arrayContaining([
        "SERVICE_NOT_COVERED",
        "DTR_TEMPLATE_INCOMPLETE",
        "ATTACHMENT_CHECKLIST_INCOMPLETE",
        "FHIR_FIELDS_MISSING"
      ])
    });
  });

  it("approves complete pharmacy benefit documentation when the request type is eligible", () => {
    const platform = createInMemoryUmPlatform();
    const priorAuth = platform.submitPriorAuth({
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
      { eventType: "PAS_SUBMITTED", caseId: priorAuth.caseId },
      { getEvidenceByCaseId: platform.getEvidence, policy: createProviderDocumentationPolicy(5), monthToDateAmount: 0 }
    );

    expect(evaluation.request.requestObject).toMatchObject({
      caseId: priorAuth.caseId,
      requestType: "pharmacy_benefit",
      serviceCode: "humira_adalimumab",
      crdCoveredBenefit: true,
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
        { eventType: "OTHER_EVENT", caseId: "PA-260524-2102-IGNORE99" },
        { getEvidenceByCaseId: getEvidence, policy: createProviderDocumentationPolicy(5), monthToDateAmount: 0 }
      )
    ).toThrow("UNSUPPORTED_PROVIDER_DOCUMENTATION_EVENT");
    expect(getEvidence).not.toHaveBeenCalled();
  });

  it("throws when PAS evidence is missing for the caseId", () => {
    const getEvidence = vi.fn(() => null);

    const missingCaseId = "PA-260524-2102-MISSING1";

    expect(() =>
      evaluateProviderDocumentationEvent(
        { eventType: "PAS_SUBMITTED", caseId: missingCaseId },
        { getEvidenceByCaseId: getEvidence, policy: createProviderDocumentationPolicy(5), monthToDateAmount: 0 }
      )
    ).toThrow(`PROVIDER_DOCUMENTATION_EVIDENCE_NOT_FOUND:${missingCaseId}`);
    expect(getEvidence).toHaveBeenCalledWith(missingCaseId);
  });

  it("blocks payment when a prohibited approval outcome metric is present", () => {
    const evidence = {
      caseId: "PA-260524-2102-AAAA1111",
      submitter: { type: "provider_admin_team", id: "lakeside-provider-admin" },
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      codingSystem: "CPT",
      billingCode: "73721",
      crdCoverageChecked: true,
      crdCoveredBenefit: true,
      dtrTemplateCompleted: true,
      attachmentChecklistComplete: true,
      fhirFieldsPresent: true,
      pasSubmitted: true,
      submittedBeforeInitialDecision: true,
      paResult: "submitted_pending",
      denialReason: null,
      paResultUsedForPositivePayment: false,
      approvalOutcomeUsed: true,
      referralVolumeMetricUsed: false,
      containsPhi: false
    } as unknown as ProviderDocumentationEvidence;

    const evaluation = evaluateProviderDocumentationEvent(
      { eventType: "PAS_SUBMITTED", caseId: evidence.caseId },
      { getEvidenceByCaseId: () => evidence, policy: createProviderDocumentationPolicy(5), monthToDateAmount: 0 }
    );

    expect(evaluation.result).toMatchObject({
      decision: "blocked",
      amount: 0,
      walletId: null,
      reasonCodes: expect.arrayContaining(["PROHIBITED_OUTCOME_METRIC"])
    });
  });
});

function createGenericPolicy(evaluationType: string): IncentivePolicy {
  return {
    id: `${evaluationType.replaceAll("_", "-")}-v1`,
    evaluationType,
    submitterRules: {
      allowedSubmitterTypes: ["provider_admin_team", "delegate_vendor", "appeals_delegate", "roster_vendor"],
      allowedSubmitters: ["lakeside-provider-admin", "northstar-um", "summit-appeals-ops", "clearpath-rosters"],
      walletMap: {
        "lakeside-provider-admin": "0.0.9049549",
        "northstar-um": "0.0.12345",
        "summit-appeals-ops": "0.0.54321",
        "clearpath-rosters": "0.0.34567"
      }
    },
    requiredEvidence: [],
    approvalRules: [],
    paymentFormula: {
      baseAmount: 5,
      maxPerRequest: 5,
      monthlyCap: 500,
      token: {
        symbol: "HBAR"
      }
    },
    requiresHumanApproval: false
  };
}

function createProviderDocumentationPolicy(amount: number): IncentivePolicy {
  return {
    id: "provider-documentation-completeness-v1",
    evaluationType: "provider_documentation_completeness",
    submitterRules: {
      allowedSubmitterTypes: ["provider_admin_team"],
      allowedSubmitters: ["lakeside-provider-admin"],
      walletMap: {
        "lakeside-provider-admin": "0.0.9049549"
      }
    },
    requiredEvidence: [
      "caseId",
      "requestType",
      "crdCoverageChecked",
      "crdCoveredBenefit",
      "dtrTemplateCompleted",
      "attachmentChecklistComplete",
      "fhirFieldsPresent",
      "pasSubmitted",
      "submittedBeforeInitialDecision",
      "paResultUsedForPositivePayment",
      "approvalOutcomeUsed",
      "referralVolumeMetricUsed",
      "containsPhi"
    ],
    approvalRules: [
      {
        field: "requestType",
        operator: "in",
        value: ["outpatient_service", "pharmacy_benefit"],
        reasonCode: "REQUEST_TYPE_NOT_ELIGIBLE"
      },
      { field: "crdCoverageChecked", operator: "equals", value: true, reasonCode: "CRD_COVERAGE_NOT_CHECKED" },
      { field: "crdCoveredBenefit", operator: "equals", value: true, reasonCode: "SERVICE_NOT_COVERED" },
      { field: "dtrTemplateCompleted", operator: "equals", value: true, reasonCode: "DTR_TEMPLATE_INCOMPLETE" },
      { field: "attachmentChecklistComplete", operator: "equals", value: true, reasonCode: "ATTACHMENT_CHECKLIST_INCOMPLETE" },
      { field: "fhirFieldsPresent", operator: "equals", value: true, reasonCode: "FHIR_FIELDS_MISSING" },
      { field: "pasSubmitted", operator: "equals", value: true, reasonCode: "PAS_NOT_SUBMITTED" },
      { field: "submittedBeforeInitialDecision", operator: "equals", value: true, reasonCode: "SUBMITTED_AFTER_INITIAL_DECISION" },
      { field: "paResultUsedForPositivePayment", operator: "equals", value: false, reasonCode: "PROHIBITED_PA_RESULT_METRIC" },
      { field: "approvalOutcomeUsed", operator: "equals", value: false, reasonCode: "PROHIBITED_OUTCOME_METRIC" },
      { field: "referralVolumeMetricUsed", operator: "equals", value: false, reasonCode: "PROHIBITED_REFERRAL_VOLUME_METRIC" },
      { field: "containsPhi", operator: "equals", value: false, reasonCode: "PHI_BLOCKED" }
    ],
    paymentFormula: {
      baseAmount: amount,
      maxPerRequest: amount,
      monthlyCap: 500,
      token: {
        symbol: "HBAR"
      }
    },
    requiresHumanApproval: false
  };
}
