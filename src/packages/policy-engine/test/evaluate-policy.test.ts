import { describe, expect, it } from "vitest";
import { evaluatePolicy, type EvaluationRequest, type IncentivePolicy } from "../src/index";

const basePolicy: IncentivePolicy = {
  id: "delegate-um-sla-bonus-v1",
  evaluationType: "delegate_um_sla_bonus",
  currency: "HBAR",
  submitterRules: {
    allowedSubmitterTypes: ["delegate_vendor"],
    allowedSubmitters: ["northstar-um"],
    walletMap: {
      "northstar-um": "0.0.12345"
    }
  },
  requiredEvidence: [
    "caseId",
    "completedWithinSla",
    "documentationComplete",
    "qualityAuditPassed",
    "denialOutcomeUsed",
    "containsPhi"
  ],
  approvalRules: [
    { field: "completedWithinSla", operator: "equals", value: true, reasonCode: "SLA_NOT_MET" },
    { field: "documentationComplete", operator: "equals", value: true, reasonCode: "DOCUMENTATION_INCOMPLETE" },
    { field: "qualityAuditPassed", operator: "equals", value: true, reasonCode: "QUALITY_AUDIT_FAILED" },
    { field: "denialOutcomeUsed", operator: "equals", value: false, reasonCode: "PROHIBITED_DENIAL_METRIC" },
    { field: "containsPhi", operator: "equals", value: false, reasonCode: "PHI_BLOCKED" }
  ],
  paymentFormula: {
    baseAmount: 5,
    maxPerRequest: 5,
    monthlyCap: 500
  },
  requiresHumanApproval: true
};

const approvedRequest: EvaluationRequest = {
  evaluationType: "delegate_um_sla_bonus",
  submitter: {
    type: "delegate_vendor",
    id: "northstar-um"
  },
  requestObject: {
    caseId: "synthetic-pa-10492",
    completedWithinSla: true,
    documentationComplete: true,
    qualityAuditPassed: true,
    denialOutcomeUsed: false,
    containsPhi: false
  }
};

describe("evaluatePolicy", () => {
  it("approves eligible evidence and computes the capped payment proposal", () => {
    const result = evaluatePolicy({
      policy: basePolicy,
      request: approvedRequest,
      monthToDateAmount: 0
    });

    expect(result).toMatchObject({
      decision: "approved",
      policyId: "delegate-um-sla-bonus-v1",
      policyVersion: "v1",
      amount: 5,
      currency: "HBAR",
      walletId: "0.0.12345",
      requiresHumanApproval: true,
      reasonCodes: []
    });
  });

  it("blocks unknown submitters before producing any payment proposal", () => {
    const result = evaluatePolicy({
      policy: basePolicy,
      request: {
        ...approvedRequest,
        submitter: {
          type: "delegate_vendor",
          id: "unknown-vendor"
        }
      },
      monthToDateAmount: 0
    });

    expect(result).toMatchObject({
      decision: "blocked",
      amount: 0,
      walletId: null,
      reasonCodes: ["SUBMITTER_NOT_ALLOWED", "WALLET_NOT_APPROVED"]
    });
  });

  it("supports membership rules for request type eligibility", () => {
    const policy: IncentivePolicy = {
      ...basePolicy,
      requiredEvidence: [...basePolicy.requiredEvidence, "requestType"],
      approvalRules: [
        ...basePolicy.approvalRules,
        {
          field: "requestType",
          operator: "in",
          value: ["outpatient_service", "pharmacy_benefit"],
          reasonCode: "REQUEST_TYPE_NOT_ELIGIBLE"
        }
      ]
    };

    const approved = evaluatePolicy({
      policy,
      request: {
        ...approvedRequest,
        requestObject: {
          ...approvedRequest.requestObject,
          requestType: "pharmacy_benefit"
        }
      },
      monthToDateAmount: 0
    });
    const blocked = evaluatePolicy({
      policy,
      request: {
        ...approvedRequest,
        requestObject: {
          ...approvedRequest.requestObject,
          requestType: "inpatient_admission"
        }
      },
      monthToDateAmount: 0
    });

    expect(approved.reasonCodes).toEqual([]);
    expect(blocked).toMatchObject({
      decision: "blocked",
      reasonCodes: expect.arrayContaining(["REQUEST_TYPE_NOT_ELIGIBLE"])
    });
  });
});
