import { beforeEach, describe, expect, it, vi } from "vitest";
import { executePolicyBoundPayment } from "@operon-labs/hedera-executor";
import { buildProviderDocumentationEvidence, createInMemoryUmPlatform, type UMPlatformEvent, type UMRequest } from "@operon-labs/um-platform";
import { createDelegateUmWorkflow, type DelegateUmRow } from "./delegate-um-workflow";
import type { PersistedIncentiveWorklistRow, StoredPasSubmission, UmPasPersistenceStore } from "./pas-persistence";
import { createInMemoryPolicyStore, defaultIncentivePolicies } from "./policy-store";

vi.mock("@operon-labs/hedera-executor", () => ({
  executePolicyBoundPayment: vi.fn(async (request: { auditId: string; currency: string }) => ({
    status: "simulated",
    network: "testnet",
    transactionId: `testnet-${request.auditId}-${request.currency.toLowerCase()}`
  }))
}));

const executePolicyBoundPaymentMock = vi.mocked(executePolicyBoundPayment);

describe("delegate UM workflow", () => {
  beforeEach(() => {
    executePolicyBoundPaymentMock.mockClear();
  });

  it("lists pending UMRequests in the delegate workqueue and starts review", async () => {
    const platform = createInMemoryUmPlatform({ generateCaseId: () => "PA-260526-0900-AAAA1111" });
    const workflow = createDelegateUmWorkflow(platform);
    const umRequest = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });

    await expect(workflow.listWorkqueue()).resolves.toEqual([
      expect.objectContaining({
        umRequestId: umRequest.id,
        id: umRequest.id,
        state: "pend",
        slaStatus: "pending"
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
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });
    await workflow.startReview(umRequest.id, "reviewer-ana");

    const row = await workflow.completeDetermination(umRequest.id, {
      outcomeStatus: "denied",
      medicalNecessityReviewed: true,
      policyCriteriaChecked: true,
      rationaleCaptured: true,
      denialReasonCode: "NOT_MEDICALLY_NECESSARY"
    });

    expect(row).toMatchObject({
      umRequestId: umRequest.id,
      id: umRequest.id,
      outcomeStatus: "denied",
      incentiveStatus: "paid",
      paymentStatus: "auto_executed",
      incentiveValue: 5,
      reasonCodes: []
    });
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        incentiveEvaluationId: umRequest.id,
        caseId: umRequest.id,
        triggerEvent: "UM_REQUEST_DETERMINED",
        amount: 5,
        walletId: "0.0.9049550"
      }),
      expect.any(Object)
    );
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
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });
    await persistence.saveUmRequest(umRequest);
    await workflow.startReview(umRequest.id, "reviewer-ana");

    const paid = await workflow.completeDetermination(umRequest.id, {
      outcomeStatus: "approved",
      medicalNecessityReviewed: true,
      policyCriteriaChecked: true,
      rationaleCaptured: true
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
          transactionId: paid.transactionId
        }),
        transactionId: paid.transactionId
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
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
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
    const second = await workflow.completeDetermination(umRequest.id, input);

    expect(second).toMatchObject({
      umRequestId: umRequest.id,
      incentiveStatus: "paid",
      transactionId: first.transactionId
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
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });
    await workflow.startReview(umRequest.id, "reviewer-ana");

    const row = await workflow.completeDetermination(umRequest.id, {
      outcomeStatus: "approved",
      medicalNecessityReviewed: true,
      policyCriteriaChecked: true,
      rationaleCaptured: true
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
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });
    await persistence.saveUmRequest({
      ...umRequest,
      slaDeadlineAt: new Date(Date.now() - 60_000).toISOString()
    });
    await workflow.startReview(umRequest.id, "reviewer-ana");

    const row = await workflow.completeDetermination(umRequest.id, {
      outcomeStatus: "approved",
      medicalNecessityReviewed: true,
      policyCriteriaChecked: true,
      rationaleCaptured: true
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
});

class FakeDelegatePersistenceStore implements UmPasPersistenceStore {
  readonly backend = "firestore" as const;
  private readonly requests = new Map<string, UMRequest>();
  private readonly rows = new Map<string, DelegateUmRow>();

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
    this.rows.set(row.umRequestId, structuredClone(row as unknown as DelegateUmRow));
  }

  async listIncentiveRows(): Promise<PersistedIncentiveWorklistRow[]> {
    return [...this.rows.values()].map((row) => structuredClone(row) as unknown as PersistedIncentiveWorklistRow);
  }

  async getIncentiveRow(umRequestId: string): Promise<PersistedIncentiveWorklistRow | null> {
    const row = this.rows.get(umRequestId);
    return row ? structuredClone(row) as unknown as PersistedIncentiveWorklistRow : null;
  }
}
