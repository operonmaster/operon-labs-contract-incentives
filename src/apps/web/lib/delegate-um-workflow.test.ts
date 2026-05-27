import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBusinessEvaluationId,
  buildPaymentIntentId,
  executePolicyBoundPayment,
  type PaymentApprovalRequest
} from "@operon-labs/hedera-executor";
import {
  buildProviderDocumentationEvidence,
  createInMemoryUmPlatform,
  getDtrQuestionnaire,
  type UMPlatformEvent,
  type UMRequest
} from "@operon-labs/um-platform";
import { createDelegateUmWorkflow, type DelegatePlanAuditRow } from "./delegate-um-workflow";
import type { PersistedIncentiveWorklistRow, StoredPasSubmission, UmPasPersistenceStore } from "./pas-persistence";
import { createInMemoryPolicyStore, defaultIncentivePolicies, type PolicyStore } from "./policy-store";

vi.mock("@operon-labs/hedera-executor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@operon-labs/hedera-executor")>();

  return {
    ...actual,
    executePolicyBoundPayment: vi.fn()
  };
});

const executePolicyBoundPaymentMock = vi.mocked(executePolicyBoundPayment);

describe("delegate UM workflow", () => {
  beforeEach(() => {
    executePolicyBoundPaymentMock.mockReset();
    executePolicyBoundPaymentMock.mockImplementation(async (request: PaymentApprovalRequest) => {
      const paymentIntentId = buildPaymentIntentId(request);

      return {
        status: "simulated",
        network: "testnet",
        transactionId: `testnet-${request.auditId}-${request.currency.toLowerCase()}`,
        runtime: "hedera-agent-kit-policy",
        paymentIntentId
      };
    });
  });

  it("lists pharmacy benefit UMRequests in the delegate workqueue by request type and starts review", async () => {
    const caseIds = ["PA-260526-0900-AAAA1111", "PA-260526-0900-AAAA2222"];
    const platform = createInMemoryUmPlatform({
      generateCaseId: () => caseIds.shift() ?? "PA-260526-0900-AAAA3333"
    });
    const workflow = createDelegateUmWorkflow(platform);
    const outpatient = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });
    const umRequest = platform.submitPriorAuth({
      requestType: "pharmacy_benefit",
      serviceCode: "wegovy_semaglutide",
      dtrQuestionnaireResponse: {
        questionnaireId: "pharmacy-weight-management-pa-v1",
        answers: getDtrQuestionnaire("pharmacy-weight-management-pa-v1")!.questions.map((question, index) => ({
          questionId: question.id,
          value: index === 2 ? "no" : "yes"
        }))
      }
    });

    expect(outpatient.delegateVendorId).toBeNull();
    await expect(workflow.listWorkqueue()).resolves.toEqual([
      expect.objectContaining({
        id: umRequest.id,
        requestType: "pharmacy_benefit",
        serviceCode: "wegovy_semaglutide",
        codingSystem: "NDC",
        billingCode: "0169-4525-14",
        state: "pend",
        coverage: expect.objectContaining({
          coveredBenefit: true,
          priorAuthRequired: true,
          documentationTemplateId: "pharmacy-weight-management-pa-v1",
          requiredDocumentation: expect.arrayContaining(["diagnosis and indication"])
        }),
        dtrQuestionnaireResponse: expect.objectContaining({
          questionnaireId: "pharmacy-weight-management-pa-v1",
          answers: expect.arrayContaining([
            expect.objectContaining({
              questionId: "prior_therapy",
              value: "no"
            })
          ])
        })
      })
    ]);

    const started = await workflow.startReview(umRequest.id, "reviewer-ana");
    expect(started).toMatchObject({
      id: umRequest.id,
      state: "in_clinical_review",
      clinicalReview: { reviewerId: "reviewer-ana" }
    });
  });

  it("settles an approved delegate SLA bonus for a denied determination completed within SLA", async () => {
    const platform = createInMemoryUmPlatform({ generateCaseId: () => "PA-260526-0900-BBBB2222" });
    const workflow = createDelegateUmWorkflow(
      platform,
      undefined,
      createInMemoryPolicyStore({
        delegate_um_acme_sla_bonus: defaultIncentivePolicies.delegate_um_acme_sla_bonus
      })
    );
    const umRequest = platform.submitPriorAuth({
      requestType: "pharmacy_benefit",
      serviceCode: "wegovy_semaglutide"
    });
    await workflow.startReview(umRequest.id, "reviewer-ana");

    const determined = await workflow.completeDetermination(umRequest.id, {
      outcomeStatus: "denied",
      medicalNecessityReviewed: true,
      policyCriteriaChecked: true,
      rationaleCaptured: true,
      denialReasonCode: "NOT_MEDICALLY_NECESSARY"
    });
    const [row] = await workflow.listPlanRows();
    const businessPolicyId = "delegate-um-sla-bonus-v1";
    const businessEvaluationId = buildBusinessEvaluationId({
      umRequestId: umRequest.id,
      businessPolicyId
    });

    expect(determined).toMatchObject({
      id: umRequest.id,
      state: "determined",
      outcomeStatus: "denied"
    });
    expect(row).toMatchObject({
      umRequestId: umRequest.id,
      id: businessEvaluationId,
      outcomeStatus: "denied",
      incentiveStatus: "paid",
      paymentStatus: "auto_executed",
      incentiveValue: 5,
      reasonCodes: []
    });
    expect(row.policyControls).toEqual([
      "Allowed delegate vendor wallet",
      "Request type limited to policy scope",
      "Determination completed within SLA",
      "Clinical review completion required",
      "Outcome status not used for payment",
      "PAS audit reference required"
    ]);
    expect(row.policyCriteria).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "plan",
        label: "Plan is in the delegate contract",
        expected: "acme-health-ppo",
        passed: true,
        reasonCode: "PLAN_NOT_IN_CONTRACT"
      }),
      expect.objectContaining({
        id: "delegateVendor",
        label: "Delegate vendor is in the contract",
        expected: "northstar-um",
        actual: "northstar-um",
        passed: true,
        reasonCode: "DELEGATE_VENDOR_NOT_IN_CONTRACT"
      }),
      expect.objectContaining({
        id: "requestType",
        label: "Request type is eligible",
        expected: "Pharmacy Benefit",
        actual: "Pharmacy Benefit",
        passed: true,
        reasonCode: "REQUEST_TYPE_NOT_ELIGIBLE"
      }),
      expect.objectContaining({
        id: "sla",
        label: "Determination completed within SLA",
        expected: "Within 24h SLA",
        passed: true,
        reasonCode: "SLA_EXCEEDED"
      }),
      expect.objectContaining({
        id: "clinicalReviewCompleted",
        label: "Clinical review checklist is complete",
        expected: "true",
        actual: "true",
        passed: true,
        reasonCode: "CLINICAL_REVIEW_INCOMPLETE"
      }),
      expect.objectContaining({
        id: "outcomeNotPaymentMetric",
        label: "Outcome status is not used for payment",
        expected: "false",
        actual: "false",
        passed: true,
        reasonCode: "PROHIBITED_OUTCOME_METRIC"
      })
    ]));
    expect(row.policyCriteria).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reasonCode: "PHI_IN_PAYMENT_METADATA"
        })
      ])
    );
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        umRequestId: umRequest.id,
        caseId: umRequest.id,
        incentiveEvaluationId: businessEvaluationId,
        businessPolicyId,
        paymentPolicyId: umRequest.planId,
        policyId: businessPolicyId,
        triggerEvent: "UM_REQUEST_DETERMINED",
        amount: 5,
        walletId: "0.0.9049549"
      }),
      expect.any(Object)
    );
    const paymentRequest = executePolicyBoundPaymentMock.mock.calls[0]![0]!;
    expect(row.id).toBe(paymentRequest.incentiveEvaluationId);
    expect(row.paymentIntentId).toBe(buildPaymentIntentId(paymentRequest));
  });

  it("loads persisted paid delegate rows after workflow re-instantiation", async () => {
    const platform = createInMemoryUmPlatform({ generateCaseId: () => "PA-260526-0900-CCCC3333" });
    const persistence = new FakeDelegatePersistenceStore();
    const workflow = createDelegateUmWorkflow(
      platform,
      persistence,
      createInMemoryPolicyStore({
        delegate_um_acme_sla_bonus: defaultIncentivePolicies.delegate_um_acme_sla_bonus
      })
    );
    const umRequest = platform.submitPriorAuth({
      requestType: "pharmacy_benefit",
      serviceCode: "wegovy_semaglutide"
    });
    await persistence.saveUmRequest(umRequest);
    await workflow.startReview(umRequest.id, "reviewer-ana");

    await workflow.completeDetermination(umRequest.id, {
      outcomeStatus: "approved",
      medicalNecessityReviewed: true,
      policyCriteriaChecked: true,
      rationaleCaptured: true
    });
    const [paidRow] = await workflow.listPlanRows();
    expect(paidRow).toMatchObject({
      umRequestId: umRequest.id,
      incentiveStatus: "paid",
      paymentStatus: "auto_executed"
    });

    const restartedWorkflow = createDelegateUmWorkflow(
      createInMemoryUmPlatform(),
      persistence,
      createInMemoryPolicyStore({
        delegate_um_acme_sla_bonus: defaultIncentivePolicies.delegate_um_acme_sla_bonus
      })
    );

    await expect(restartedWorkflow.listPlanRows()).resolves.toEqual([
      expect.objectContaining({
        umRequestId: umRequest.id,
        incentiveStatus: "paid",
        paymentStatus: "auto_executed",
        audit: expect.objectContaining({
          policyId: "delegate-um-sla-bonus-v1",
          transactionId: paidRow?.transactionId
        }),
        transactionId: paidRow?.transactionId
      })
    ]);
  });

  it("reattaches UMRequest details when loading legacy persisted delegate rows", async () => {
    const platform = createInMemoryUmPlatform({ generateCaseId: () => "PA-260526-0900-LEGACY1" });
    const persistence = new FakeDelegatePersistenceStore();
    const umRequest = platform.submitPriorAuth({
      requestType: "pharmacy_benefit",
      serviceCode: "wegovy_semaglutide"
    });
    const paidRow = buildPaidDelegateRow(umRequest);
    const legacyPersistedRow: Record<string, unknown> = {
      ...paidRow,
      caseId: paidRow.umRequestId
    };
    delete legacyPersistedRow.umRequest;
    await persistence.saveUmRequest(paidRow.umRequest);
    await persistence.saveIncentiveRow(legacyPersistedRow as unknown as PersistedIncentiveWorklistRow);

    const restartedWorkflow = createDelegateUmWorkflow(
      createInMemoryUmPlatform(),
      persistence,
      createInMemoryPolicyStore({
        delegate_um_acme_sla_bonus: defaultIncentivePolicies.delegate_um_acme_sla_bonus
      })
    );

    await expect(restartedWorkflow.listPlanRows()).resolves.toEqual([
      expect.objectContaining({
        umRequestId: umRequest.id,
        incentiveStatus: "paid",
        paymentStatus: "auto_executed",
        transactionId: paidRow.transactionId,
        umRequest: expect.objectContaining({
          id: umRequest.id,
          state: "determined",
          outcomeStatus: "approved"
        })
      })
    ]);
  });

  it("does not execute a second payment for an already paid delegate determination", async () => {
    const platform = createInMemoryUmPlatform({ generateCaseId: () => "PA-260526-0900-DDDD4444" });
    const persistence = new FakeDelegatePersistenceStore();
    const workflow = createDelegateUmWorkflow(
      platform,
      persistence,
      createInMemoryPolicyStore({
        delegate_um_acme_sla_bonus: defaultIncentivePolicies.delegate_um_acme_sla_bonus
      })
    );
    const umRequest = platform.submitPriorAuth({
      requestType: "pharmacy_benefit",
      serviceCode: "wegovy_semaglutide"
    });
    await persistence.saveUmRequest(umRequest);
    await workflow.startReview(umRequest.id, "reviewer-ana");

    const input = {
      outcomeStatus: "approved" as const,
      medicalNecessityReviewed: true,
      policyCriteriaChecked: true,
      rationaleCaptured: true
    };
    const first = await workflow.completeDetermination(umRequest.id, input);
    const [firstRow] = await workflow.listPlanRows();
    const second = await workflow.completeDetermination(umRequest.id, input);
    const [secondRow] = await workflow.listPlanRows();

    expect(first).toMatchObject({
      id: umRequest.id,
      state: "determined",
      outcomeStatus: "approved"
    });
    expect(second).toMatchObject({
      id: umRequest.id,
      state: "determined",
      outcomeStatus: "approved"
    });
    expect(secondRow).toMatchObject({
      umRequestId: umRequest.id,
      incentiveStatus: "paid",
      transactionId: firstRow?.transactionId
    });
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledTimes(1);
  });

  it("blocks payment when more than one active delegate policy matches", async () => {
    const platform = createInMemoryUmPlatform({ generateCaseId: () => "PA-260526-0900-EEEE5555" });
    const workflow = createDelegateUmWorkflow(
      platform,
      undefined,
      createInMemoryPolicyStore({
        delegate_um_acme_sla_bonus: defaultIncentivePolicies.delegate_um_acme_sla_bonus,
        delegate_um_acme_manual_sla_bonus: {
          ...structuredClone(defaultIncentivePolicies.delegate_um_acme_sla_bonus),
          policyId: "delegate-um-sla-bonus-manual-v1",
          settlement: {
            ...defaultIncentivePolicies.delegate_um_acme_sla_bonus.settlement,
            mode: "manual"
          }
        }
      })
    );
    const umRequest = platform.submitPriorAuth({
      requestType: "pharmacy_benefit",
      serviceCode: "wegovy_semaglutide"
    });
    await workflow.startReview(umRequest.id, "reviewer-ana");

    const determined = await workflow.completeDetermination(umRequest.id, {
      outcomeStatus: "approved",
      medicalNecessityReviewed: true,
      policyCriteriaChecked: true,
      rationaleCaptured: true
    });
    const [row] = await workflow.listPlanRows();

    expect(determined).toMatchObject({
      id: umRequest.id,
      state: "determined",
      outcomeStatus: "approved"
    });
    expect(row).toMatchObject({
      umRequestId: umRequest.id,
      incentiveStatus: "not_eligible",
      paymentStatus: "blocked_by_policy",
      incentiveValue: 0,
      reasonCodes: ["MULTIPLE_POLICY_MATCHES"],
      transactionId: null
    });
    expect(executePolicyBoundPaymentMock).not.toHaveBeenCalled();
  });

  it("blocks payment when the delegate determination misses the SLA", async () => {
    const platform = createInMemoryUmPlatform({ generateCaseId: () => "PA-260526-0900-FFFF6666" });
    const persistence = new FakeDelegatePersistenceStore();
    const workflow = createDelegateUmWorkflow(
      platform,
      persistence,
      createInMemoryPolicyStore({
        delegate_um_acme_sla_bonus: defaultIncentivePolicies.delegate_um_acme_sla_bonus
      })
    );
    const umRequest = platform.submitPriorAuth({
      requestType: "pharmacy_benefit",
      serviceCode: "wegovy_semaglutide"
    });
    await persistence.saveUmRequest({
      ...umRequest,
      slaDeadlineAt: new Date(Date.now() - 60_000).toISOString()
    });
    await workflow.startReview(umRequest.id, "reviewer-ana");

    const determined = await workflow.completeDetermination(umRequest.id, {
      outcomeStatus: "approved",
      medicalNecessityReviewed: true,
      policyCriteriaChecked: true,
      rationaleCaptured: true
    });
    await workflow.completeDetermination(umRequest.id, {
      outcomeStatus: "approved",
      medicalNecessityReviewed: true,
      policyCriteriaChecked: true,
      rationaleCaptured: true
    });
    const [row] = await workflow.listPlanRows();

    expect(determined).toMatchObject({
      id: umRequest.id,
      state: "determined",
      outcomeStatus: "approved"
    });
    expect(row).toMatchObject({
      umRequestId: umRequest.id,
      slaStatus: "breached",
      incentiveStatus: "not_eligible",
      paymentStatus: "blocked_by_policy",
      reasonCodes: ["SLA_EXCEEDED"],
      transactionId: null
    });
    expect(executePolicyBoundPaymentMock).not.toHaveBeenCalled();
  });

  it("blocks payment when no delegate SLA policy matches the request", async () => {
    const platform = createInMemoryUmPlatform({ generateCaseId: () => "PA-260526-0900-NNNN9999" });
    const workflow = createDelegateUmWorkflow(
      platform,
      undefined,
      createPolicyStoreWithoutMatches()
    );
    const umRequest = platform.submitPriorAuth({
      planId: "summit-health-hmo",
      requestType: "pharmacy_benefit",
      serviceCode: "wegovy_semaglutide"
    });
    await workflow.startReview(umRequest.id, "reviewer-ana");

    const determined = await workflow.completeDetermination(umRequest.id, {
      outcomeStatus: "approved",
      medicalNecessityReviewed: true,
      policyCriteriaChecked: true,
      rationaleCaptured: true
    });
    await workflow.completeDetermination(umRequest.id, {
      outcomeStatus: "approved",
      medicalNecessityReviewed: true,
      policyCriteriaChecked: true,
      rationaleCaptured: true
    });
    const [row] = await workflow.listPlanRows();

    expect(determined).toMatchObject({
      id: umRequest.id,
      state: "determined",
      outcomeStatus: "approved"
    });
    expect(row).toMatchObject({
      umRequestId: umRequest.id,
      incentiveStatus: "not_eligible",
      paymentStatus: "blocked_by_policy",
      reasonCodes: ["POLICY_NOT_FOUND"],
      transactionId: null
    });
    expect(executePolicyBoundPaymentMock).not.toHaveBeenCalled();
  });

  it("excludes non-delegated UM requests and rejects determination without defaulting to Northstar", async () => {
    const platform = createInMemoryUmPlatform({ generateCaseId: () => "PA-260526-0900-GGGG7777" });
    const persistence = new FakeDelegatePersistenceStore();
    const workflow = createDelegateUmWorkflow(
      platform,
      persistence,
      createInMemoryPolicyStore({
        delegate_um_acme_sla_bonus: defaultIncentivePolicies.delegate_um_acme_sla_bonus
      })
    );
    const umRequest = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });
    const started = platform.startClinicalReview(umRequest.id, "reviewer-ana");
    await persistence.saveUmRequest({
      ...started,
      delegateVendorId: null
    });

    await expect(workflow.listWorkqueue()).resolves.toEqual([]);
    await expect(workflow.listPlanRows()).resolves.toEqual([]);
    await expect(
      workflow.completeDetermination(umRequest.id, {
        outcomeStatus: "approved",
        medicalNecessityReviewed: true,
        policyCriteriaChecked: true,
        rationaleCaptured: true
      })
    ).rejects.toThrow(`UM_REQUEST_NOT_DELEGATED:${umRequest.id}`);
    expect(executePolicyBoundPaymentMock).not.toHaveBeenCalled();
  });

  it("returns a concurrently persisted paid row when payment execution fails after another instance settled", async () => {
    const platform = createInMemoryUmPlatform({ generateCaseId: () => "PA-260526-0900-HHHH8888" });
    const persistence = new FakeDelegatePersistenceStore();
    const workflow = createDelegateUmWorkflow(
      platform,
      persistence,
      createInMemoryPolicyStore({
        delegate_um_acme_sla_bonus: defaultIncentivePolicies.delegate_um_acme_sla_bonus
      })
    );
    const umRequest = platform.submitPriorAuth({
      requestType: "pharmacy_benefit",
      serviceCode: "wegovy_semaglutide"
    });
    await persistence.saveUmRequest(umRequest);
    await workflow.startReview(umRequest.id, "reviewer-ana");
    const persistedReview = await persistence.getUmRequest(umRequest.id);
    if (!persistedReview) {
      throw new Error("TEST_PERSISTED_REVIEW_MISSING");
    }
    const concurrentPaidRow = buildPaidDelegateRow(persistedReview);
    executePolicyBoundPaymentMock.mockImplementationOnce(async () => {
      await persistence.saveIncentiveRow(concurrentPaidRow as unknown as PersistedIncentiveWorklistRow);
      throw new Error("DUPLICATE_PAYMENT_BLOCKED");
    });

    const determined = await workflow.completeDetermination(umRequest.id, {
      outcomeStatus: "approved",
      medicalNecessityReviewed: true,
      policyCriteriaChecked: true,
      rationaleCaptured: true
    });
    const [row] = await workflow.listPlanRows();

    expect(determined).toMatchObject({
      id: umRequest.id,
      state: "determined",
      outcomeStatus: "approved"
    });
    expect(row).toMatchObject({
      umRequestId: umRequest.id,
      incentiveStatus: "paid",
      paymentStatus: "auto_executed",
      transactionId: concurrentPaidRow.transactionId
    });
    await expect(persistence.getIncentiveRow(umRequest.id)).resolves.toMatchObject({
      incentiveStatus: "paid",
      transactionId: concurrentPaidRow.transactionId
    });
  });
});

function buildPaidDelegateRow(request: UMRequest): DelegatePlanAuditRow {
  const determinedAt = new Date().toISOString();
  const businessPolicyId = "delegate-um-sla-bonus-v1";
  const businessEvaluationId = buildBusinessEvaluationId({
    umRequestId: request.id,
    businessPolicyId
  });
  const paymentIntentId = buildPaymentIntentId({
    umRequestId: request.id,
    caseId: request.id,
    incentiveEvaluationId: businessEvaluationId,
    businessPolicyId,
    paymentPolicyId: request.planId
  });

  return {
    evaluationType: "delegate_um_sla_bonus",
    umRequest: {
      ...request,
      state: "determined",
      outcomeStatus: "approved",
      determinedAt
    },
    umRequestId: request.id,
    id: businessEvaluationId,
    planId: request.planId,
    planDisplay: request.planDisplay,
    delegateVendorId: requireTestDelegateVendorId(request),
    requestType: request.requestType,
    serviceLabel: request.serviceLabel,
    submittedAt: request.submittedAt,
    pendStartedAt: request.pendStartedAt,
    slaDeadlineAt: request.slaDeadlineAt,
    determinedAt,
    timeRemainingMs: 0,
    state: "determined",
    outcomeStatus: "approved",
    slaStatus: "within_sla",
    incentiveStatus: "paid",
    paymentStatus: "auto_executed",
    incentiveValue: 5,
    currency: "HBAR",
    settlementToken: { symbol: "HBAR" },
    reason: "Concurrent payment already settled",
    reasonCodes: [],
    policyId: businessPolicyId,
    policyControls: [
      "Allowed delegate vendor wallet",
      "Request type limited to policy scope",
      "Determination completed within SLA",
      "Clinical review completion required",
      "Outcome status not used for payment",
      "PAS audit reference required"
    ],
    policyCriteria: [],
    audit: {
      id: `audit-test-${request.id}`,
      requestHash: `hash-${request.id}`,
      policyId: businessPolicyId,
      policyVersion: "v1",
      decision: "approved",
      reasonCodes: [],
      transactionId: `testnet-concurrent-${request.id}`,
      createdAt: new Date().toISOString()
    },
    walletId: "0.0.9049549",
    paymentIntentId,
    transactionId: `testnet-concurrent-${request.id}`
  };
}

function requireTestDelegateVendorId(request: UMRequest): string {
  if (!request.delegateVendorId) {
    throw new Error(`TEST_DELEGATE_VENDOR_REQUIRED:${request.id}`);
  }

  return request.delegateVendorId;
}

class FakeDelegatePersistenceStore implements UmPasPersistenceStore {
  readonly backend = "firestore" as const;
  private readonly requests = new Map<string, UMRequest>();
  private readonly rows = new Map<string, DelegatePlanAuditRow>();

  async savePasSubmission(request: StoredPasSubmission): Promise<void> {
    await this.saveUmRequest(request.umRequest);
  }

  async saveUmRequest(umRequest: UMRequest): Promise<void> {
    this.requests.set(umRequest.id, structuredClone(umRequest));
  }

  async listUmRequests(): Promise<UMRequest[]> {
    return [...this.requests.values()].map((request) => structuredClone(request));
  }

  async getUmRequest(umRequestId: string): Promise<UMRequest | null> {
    const request = this.requests.get(umRequestId);
    return request ? structuredClone(request) : null;
  }

  async listUmEvents(): Promise<UMPlatformEvent[]> {
    return [...this.requests.values()].flatMap((request) => [
      { eventType: "PAS_SUBMITTED", caseId: request.id, umRequestId: request.id },
      { eventType: "UM_REQUEST_CREATED", caseId: request.id, umRequestId: request.id }
    ]);
  }

  async savePriorAuth(request: { record: UMRequest }): Promise<void> {
    await this.saveUmRequest(request.record);
  }

  async listPriorAuthRecords(): Promise<UMRequest[]> {
    return this.listUmRequests();
  }

  async getPriorAuthRecord(caseId: string): Promise<UMRequest | null> {
    return this.getUmRequest(caseId);
  }

  async getEvidence(umRequestId: string) {
    const request = await this.getUmRequest(umRequestId);
    return request ? buildProviderDocumentationEvidence(request) : null;
  }

  async listPasEvents() {
    return (await this.listUmEvents()).filter((event) => event.eventType === "PAS_SUBMITTED");
  }

  async saveIncentiveRow(row: PersistedIncentiveWorklistRow): Promise<void> {
    this.rows.set(row.umRequestId, structuredClone(row as unknown as DelegatePlanAuditRow));
  }

  async listIncentiveRows(): Promise<PersistedIncentiveWorklistRow[]> {
    return [...this.rows.values()].map((row) => structuredClone(row) as unknown as PersistedIncentiveWorklistRow);
  }

  async getIncentiveRow(
    umRequestId: string,
    businessPolicyId?: string
  ): Promise<PersistedIncentiveWorklistRow | null> {
    const row = this.rows.get(umRequestId);
    if (row && businessPolicyId && row.policyId !== businessPolicyId) {
      return null;
    }

    return row ? structuredClone(row) as unknown as PersistedIncentiveWorklistRow : null;
  }
}

function createPolicyStoreWithoutMatches(): PolicyStore {
  return {
    backend: "memory",
    seedDefaults: async () => {},
    getPolicy: async () => null,
    getPolicyById: async () => null,
    findPolicy: async () => null,
    findPolicies: async () => [],
    listPolicies: async () => [],
    savePolicy: async () => {}
  };
}
