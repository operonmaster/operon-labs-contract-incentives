import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProviderDocumentationWorkflow, type IncentiveWorklistRow } from "./provider-documentation-workflow";
import { createDelegateUmWorkflow } from "./delegate-um-workflow";
import type { PersistedIncentiveWorklistRow, StoredPasSubmission, UmPasPersistenceStore } from "./pas-persistence";
import { createInMemoryPolicyStore, defaultIncentivePolicies } from "./policy-store";
import {
  buildBusinessEvaluationId,
  buildPaymentIntentId,
  executePolicyBoundPayment,
  type PaymentApprovalRequest
} from "@operon-labs/hedera-executor";
import {
  buildPasFhirBundle,
  buildProviderDocumentationEvidence,
  createInMemoryUmPlatform,
  getDtrQuestionnaire,
  type UMRequest
} from "@operon-labs/um-platform";
import type { PaymentPolicyEvidence, PaymentPolicyEvidenceStore } from "./payment-policy-evidence-store";
import { createInMemoryPaymentPolicyStore, defaultPaymentPlanPolicies } from "./payment-policy-store";

vi.mock("@operon-labs/hedera-executor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@operon-labs/hedera-executor")>();

  return {
    ...actual,
    executePolicyBoundPayment: vi.fn()
  };
});

const executePolicyBoundPaymentMock = vi.mocked(executePolicyBoundPayment);
const PA_CASE_ID_PATTERN = /^PA-\d{6}-\d{4}-[A-Z0-9]{8}$/;
const IMPLEMENTATION_GUARDRAIL_CRITERIA = [
  "Plan is in the contract pair",
  "Provider is in the contract pair",
  "Recipient wallet is approved",
  "Settlement token is policy-defined"
] as const;

function expectNoImplementationGuardrailCriteria(row: IncentiveWorklistRow) {
  const labels = row.policyCriteria.map((criterion) => criterion.label);

  IMPLEMENTATION_GUARDRAIL_CRITERIA.forEach((label) => {
    expect(labels).not.toContain(label);
  });
}

describe("provider documentation workflow", () => {
  beforeEach(() => {
    executePolicyBoundPaymentMock.mockReset();
    executePolicyBoundPaymentMock.mockImplementation(async (request: PaymentApprovalRequest) => {
      await new Promise((resolve) => setTimeout(resolve, 5));

      const paymentIntentId = buildPaymentIntentId(request);
      return {
        status: "simulated",
        network: "testnet",
        transactionId: `testnet-${request.auditId}-${request.currency.toLowerCase()}-${Date.now()}`,
        runtime: "hedera-agent-kit-policy",
        paymentIntentId
      };
    });
  });

  it("submits knee MRI and automatically settles the eligible policy payment", async () => {
    const workflow = createProviderDocumentationWorkflow();

    const submitted = await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const rows = await workflow.listIncentiveRows();
    const businessEvaluationId = buildBusinessEvaluationId({
      umRequestId: submitted.id,
      businessPolicyId: rows[0]!.policyId
    });

    expect(submitted.caseId).toMatch(PA_CASE_ID_PATTERN);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: businessEvaluationId,
      umRequestId: submitted.id,
      caseId: submitted.id,
      serviceLabel: "Knee MRI after injury",
      outcomeStatus: null,
      businessPolicyStatus: "approved",
      paymentPolicyStatus: "paid",
      incentiveStatus: "paid",
      paymentStatus: "auto_executed",
      incentiveValue: 3,
      currency: "HBAR",
      reason: "Completed requested DTR"
    });
    expect(rows[0]).toMatchObject({
      paymentPolicyId: "acme-health-ppo",
      paymentPolicyControls: expect.arrayContaining([
        expect.objectContaining({ id: "businessEvaluationAttestation", label: "Business evaluation attestation", status: "passed" }),
        expect.objectContaining({ id: "paymentToken", label: "Payment token", status: "passed", expected: "HBAR", actual: "HBAR" }),
        expect.objectContaining({ id: "maxPaymentPerRequest", label: "Max payment per request", status: "passed", expected: "<= 7 HBAR", actual: "3 HBAR" }),
        expect.objectContaining({ id: "duplicatePaymentPrevention", label: "Duplicate payment prevention", status: "passed" }),
        expect.objectContaining({ id: "paymentEnvelopeIntegrity", label: "Payment envelope integrity", status: "passed" })
      ])
    });
    expect(rows[0]).not.toHaveProperty("paResult");
    expect(rows[0]).not.toHaveProperty("denialReason");
    expect(rows[0]!.transactionId).toContain("testnet-");
    // In memory mode (tests) the lib has no durable intent store, so the workflow
    // forwards `undefined` and the executor uses its own in-process fallback. The
    // production firestore default is covered by payment-intent-store.test.ts.
    expect(executePolicyBoundPaymentMock.mock.calls[0]?.[1]?.paymentIntentStore).toBeUndefined();
    expect(rows[0]!.policyControls).toEqual(
      expect.arrayContaining([
        "Allowed submitter and recipient wallet",
        "Request type limited to Outpatient Service",
        "Service code limited to policy scope",
        "DTR requested and completed",
        "3 HBAR per eligible request",
        "500 HBAR monthly cap"
      ])
    );
    expect(rows[0]!.policyCriteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Request type is eligible",
          expected: "Outpatient Service",
          actual: "Outpatient Service",
          passed: true,
          reasonCode: "REQUEST_TYPE_NOT_ELIGIBLE"
        }),
        expect.objectContaining({
          label: "Service code is included",
          expected: "73721",
          actual: "73721",
          passed: true,
          reasonCode: "SERVICE_CODE_NOT_INCLUDED"
        }),
        expect.objectContaining({
          label: "Request is a covered benefit",
          expected: "true",
          actual: "true",
          passed: true,
          reasonCode: "BENEFIT_NOT_COVERED"
        }),
        expect.objectContaining({
          label: "DTR was requested",
          expected: "true",
          actual: "true",
          passed: true,
          reasonCode: "DTR_NOT_REQUESTED"
        }),
        expect.objectContaining({
          label: "Requested DTR is complete",
          expected: "true",
          actual: "true",
          passed: true,
          reasonCode: "DTR_TEMPLATE_INCOMPLETE"
        })
      ])
    );
    expectNoImplementationGuardrailCriteria(rows[0]!);
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledTimes(1);
    const paymentRequest = executePolicyBoundPaymentMock.mock.calls[0]![0]!;
    expect(paymentRequest).toMatchObject({
      umRequestId: submitted.id,
      caseId: submitted.id,
      incentiveEvaluationId: businessEvaluationId,
      planId: "acme-health-ppo",
      paymentPolicyId: submitted.planId,
      businessPolicyId: rows[0]!.policyId,
      policyId: rows[0]!.policyId,
      amount: 3,
      currency: "HBAR",
      walletId: "0.0.9049549"
    });
    expect(rows[0]!.id).toBe(paymentRequest.incentiveEvaluationId);
    expect(rows[0]!.paymentIntentId).toBe(buildPaymentIntentId(paymentRequest));
    expect(executePolicyBoundPaymentMock.mock.calls[0]?.[1]).toMatchObject({
      planPolicy: expect.objectContaining({
        planId: "acme-health-ppo",
        businessEvaluationAttestation: true,
        duplicatePaymentPrevention: true,
        paymentToken: "HBAR",
        maxPaymentAmount: 7
      })
    });
    const businessEvaluationStore = executePolicyBoundPaymentMock.mock.calls[0]![1]!.businessEvaluationStore;
    expect(businessEvaluationStore).toBeDefined();
    await expect(
      businessEvaluationStore!.getAttestation({
        incentiveEvaluationId: businessEvaluationId,
        umRequestId: submitted.id,
        caseId: submitted.caseId,
        planId: "acme-health-ppo",
        policyId: rows[0]!.policyId,
        businessPolicyId: rows[0]!.policyId
      })
    ).resolves.toMatchObject({
      incentiveEvaluationId: businessEvaluationId,
      umRequestId: submitted.id,
      caseId: submitted.caseId
    });
  });

  it("derives provider payment policy controls for legacy persisted paid rows", async () => {
    const platform = createInMemoryUmPlatform({ generateCaseId: () => "PA-260528-1100-LEGACY01" });
    const persistence = new FakeMixedPasPersistenceStore();
    const submitted = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const evidence = platform.getEvidence(submitted.id)!;
    const businessPolicyId = "provider-documentation-completeness-v1";
    const businessEvaluationId = buildBusinessEvaluationId({
      umRequestId: submitted.id,
      businessPolicyId
    });
    const paymentIntentId = buildPaymentIntentId({
      umRequestId: submitted.id,
      caseId: submitted.id,
      incentiveEvaluationId: businessEvaluationId,
      businessPolicyId,
      paymentPolicyId: submitted.planId
    });
    await persistence.savePasSubmission({
      umRequest: submitted,
      evidence,
      fhirBundle: buildPasFhirBundle(submitted, evidence)
    });
    await persistence.saveIncentiveRow({
      evaluationType: "provider_documentation_completeness",
      id: businessEvaluationId,
      umRequestId: submitted.id,
      caseId: submitted.id,
      planId: submitted.planId,
      planDisplay: submitted.planDisplay,
      submittedAt: submitted.submittedAt,
      providerGroupDisplay: submitted.providerGroupDisplay,
      requestType: submitted.requestType,
      serviceLabel: submitted.serviceLabel,
      serviceCode: submitted.serviceCode,
      state: submitted.state,
      outcomeStatus: submitted.outcomeStatus,
      businessPolicyStatus: "approved",
      paymentPolicyStatus: "paid",
      incentiveStatus: "paid",
      paymentStatus: "auto_executed",
      incentiveValue: 5,
      currency: "HBAR",
      settlementToken: { symbol: "HBAR" },
      reason: "Legacy row without payment policy evidence fields",
      reasonCodes: [],
      policyId: businessPolicyId,
      policyControls: [],
      policyCriteria: [
        {
          id: "plan",
          label: "Plan is in the contract pair",
          expected: "acme-health-ppo",
          actual: "acme-health-ppo",
          passed: true,
          reasonCode: "PLAN_NOT_IN_CONTRACT"
        },
        {
          id: "provider",
          label: "Provider is in the contract pair",
          expected: "lakeside-provider-admin",
          actual: "lakeside-provider-admin",
          passed: true,
          reasonCode: "PROVIDER_NOT_IN_CONTRACT"
        },
        {
          id: "wallet",
          label: "Recipient wallet is approved",
          expected: "0.0.9049549",
          actual: "0.0.9049549",
          passed: true,
          reasonCode: "WALLET_NOT_APPROVED"
        },
        {
          id: "settlement_token",
          label: "Settlement token is policy-defined",
          expected: "HBAR",
          actual: "HBAR",
          passed: true,
          reasonCode: "SETTLEMENT_TOKEN_CONFIGURED"
        },
        {
          id: "requestType",
          label: "Request type is eligible",
          expected: "Outpatient Service",
          actual: "Outpatient Service",
          passed: true,
          reasonCode: "REQUEST_TYPE_NOT_ELIGIBLE"
        },
        {
          id: "service_code",
          label: "Service code is included",
          expected: "73721",
          actual: "73721",
          passed: true,
          reasonCode: "SERVICE_CODE_NOT_INCLUDED"
        },
        {
          id: "coveredBenefit",
          label: "Request is a covered benefit",
          expected: "true",
          actual: "true",
          passed: true,
          reasonCode: "BENEFIT_NOT_COVERED"
        },
        {
          id: "dtrRequested",
          label: "DTR was requested",
          expected: "true",
          actual: "true",
          passed: true,
          reasonCode: "DTR_NOT_REQUESTED"
        },
        {
          id: "dtrTemplateCompleted",
          label: "Requested DTR is complete",
          expected: "true",
          actual: "true",
          passed: true,
          reasonCode: "DTR_TEMPLATE_INCOMPLETE"
        }
      ],
      audit: {
        id: "audit-legacy-provider-paid",
        requestHash: "hash-legacy-provider-paid",
        policyId: businessPolicyId,
        policyVersion: "v1",
        decision: "approved",
        reasonCodes: [],
        transactionId: "testnet-legacy-provider-paid",
        createdAt: submitted.submittedAt
      },
      walletId: "0.0.9049549",
      paymentIntentId,
      transactionId: "testnet-legacy-provider-paid"
    } as unknown as PersistedIncentiveWorklistRow);

    const workflow = createProviderDocumentationWorkflow(
      createInMemoryUmPlatform(),
      persistence,
      createInMemoryPolicyStore({
        provider_documentation_acme_outpatient: defaultIncentivePolicies.provider_documentation_acme_outpatient
      }),
      undefined,
      createInMemoryPaymentPolicyStore(defaultPaymentPlanPolicies)
    );
    const row = await workflow.getIncentiveRow(submitted.id);

    expect(row).toMatchObject({
      paymentPolicyId: "acme-health-ppo",
      paymentPolicyControls: expect.arrayContaining([
        expect.objectContaining({ label: "Business evaluation attestation" }),
        expect.objectContaining({ label: "Payment token" }),
        expect.objectContaining({ label: "Max payment per request" }),
        expect.objectContaining({ label: "Duplicate payment prevention" }),
        expect.objectContaining({ label: "Payment envelope integrity" })
      ])
    });
    expectNoImplementationGuardrailCriteria(row!);
    expect(row!.policyCriteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Request type is eligible" }),
        expect.objectContaining({ label: "Service code is included" }),
        expect.objectContaining({ label: "Request is a covered benefit" }),
        expect.objectContaining({ label: "DTR was requested" }),
        expect.objectContaining({ label: "Requested DTR is complete" })
      ])
    );
  });

  it("allows provider documentation and delegate UM incentives to settle for the same UM request without payment intent collision", async () => {
    const platform = createInMemoryUmPlatform({ generateCaseId: () => "PA-260526-0900-SAMEUM01" });
    const paymentIntentIds = new Set<string>();
    executePolicyBoundPaymentMock.mockImplementation(async (request: PaymentApprovalRequest) => {
      const paymentIntentId = buildPaymentIntentId(request);
      if (paymentIntentIds.has(paymentIntentId)) {
        throw new Error("DUPLICATE_PAYMENT_BLOCKED");
      }
      paymentIntentIds.add(paymentIntentId);

      return {
        status: "submitted",
        network: "testnet",
        transactionId: `testnet-${paymentIntentId}`,
        runtime: "hedera-agent-kit-policy",
        paymentIntentId
      };
    });
    const providerWorkflow = createProviderDocumentationWorkflow(
      platform,
      undefined,
      createInMemoryPolicyStore({
        provider_documentation_summit_pharmacy: defaultIncentivePolicies.provider_documentation_summit_pharmacy
      })
    );
    const delegateWorkflow = createDelegateUmWorkflow(
      platform,
      undefined,
      createInMemoryPolicyStore({
        delegate_um_summit_pharmacy_sla_bonus: defaultIncentivePolicies.delegate_um_summit_pharmacy_sla_bonus
      })
    );

    const submitted = await providerWorkflow.submitPriorAuth({
      planId: "summit-health-hmo",
      planDisplay: "Summit Health HMO",
      requestType: "pharmacy_benefit",
      serviceCode: "wegovy_semaglutide",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    await delegateWorkflow.startReview(submitted.id, "reviewer-ana");
    await delegateWorkflow.completeDetermination(submitted.id, {
      outcomeStatus: "approved",
      clinicalDocumentationReviewed: true,
      medicalNecessityCriteriaMet: true,
      planPolicyRequirementsChecked: true,
      decisionRationaleDocumented: true
    });
    const providerRow = await providerWorkflow.getIncentiveRow(submitted.id);
    const [delegateRow] = await delegateWorkflow.listPlanRows();

    expect(executePolicyBoundPaymentMock).toHaveBeenCalledTimes(2);
    expect(providerRow).toMatchObject({
      id: buildBusinessEvaluationId({
        umRequestId: submitted.id,
        businessPolicyId: providerRow!.policyId
      }),
      umRequestId: submitted.id,
      caseId: submitted.id,
      incentiveStatus: "paid",
      paymentStatus: "auto_executed"
    });
    expect(delegateRow).toMatchObject({
      id: buildBusinessEvaluationId({
        umRequestId: submitted.id,
        businessPolicyId: "delegate-um-summit-pharmacy-sla-bonus-v1"
      }),
      umRequestId: submitted.id,
      incentiveStatus: "paid",
      paymentStatus: "auto_executed"
    });
    expect(providerRow!.paymentIntentId).toMatch(/^pi_[a-f0-9]{32}$/);
    expect(delegateRow!.paymentIntentId).toMatch(/^pi_[a-f0-9]{32}$/);
    expect(providerRow!.paymentIntentId).not.toBe(delegateRow!.paymentIntentId);
    expect(paymentIntentIds.size).toBe(2);
  });

  it("keeps provider and delegate rows separate after restart when both are persisted for the same UM request", async () => {
    const platform = createInMemoryUmPlatform({ generateCaseId: () => "PA-260527-1300-MIXED001" });
    const persistence = new FakeMixedPasPersistenceStore();
    const providerPolicyStore = createInMemoryPolicyStore({
      provider_documentation_summit_pharmacy: defaultIncentivePolicies.provider_documentation_summit_pharmacy
    });
    const delegatePolicyStore = createInMemoryPolicyStore({
      delegate_um_summit_pharmacy_sla_bonus: defaultIncentivePolicies.delegate_um_summit_pharmacy_sla_bonus
    });
    const providerWorkflow = createProviderDocumentationWorkflow(
      platform,
      persistence,
      providerPolicyStore
    );
    const delegateWorkflow = createDelegateUmWorkflow(
      platform,
      persistence,
      delegatePolicyStore
    );

    const submitted = await providerWorkflow.submitPriorAuth({
      planId: "summit-health-hmo",
      planDisplay: "Summit Health HMO",
      requestType: "pharmacy_benefit",
      serviceCode: "wegovy_semaglutide",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    await delegateWorkflow.startReview(submitted.id, "reviewer-ana");
    await delegateWorkflow.completeDetermination(submitted.id, {
      outcomeStatus: "approved",
      clinicalDocumentationReviewed: true,
      medicalNecessityCriteriaMet: true,
      planPolicyRequirementsChecked: true,
      decisionRationaleDocumented: true
    });

    const persistedRows = await persistence.listIncentiveRows();
    expect(persistedRows.map((row) => row.evaluationType)).toEqual([
      "delegate_um_sla_bonus",
      "provider_documentation_completeness"
    ]);
    expect(persistedRows.map((row) => row.umRequestId)).toEqual([submitted.id, submitted.id]);

    executePolicyBoundPaymentMock.mockClear();
    executePolicyBoundPaymentMock.mockRejectedValue(new Error("TEST_RESTART_SHOULD_NOT_EXECUTE_PAYMENT"));
    const restartedProviderWorkflow = createProviderDocumentationWorkflow(
      createInMemoryUmPlatform(),
      persistence,
      providerPolicyStore
    );
    const restartedDelegateWorkflow = createDelegateUmWorkflow(
      createInMemoryUmPlatform(),
      persistence,
      delegatePolicyStore
    );

    const providerRow = await restartedProviderWorkflow.getIncentiveRow(submitted.id);
    const delegateRows = await restartedDelegateWorkflow.listPlanRows();
    await restartedDelegateWorkflow.completeDetermination(submitted.id, {
      outcomeStatus: "approved",
      clinicalDocumentationReviewed: true,
      medicalNecessityCriteriaMet: true,
      planPolicyRequirementsChecked: true,
      decisionRationaleDocumented: true
    });

    expect(providerRow).toMatchObject({
      evaluationType: "provider_documentation_completeness",
      umRequestId: submitted.id,
      incentiveStatus: "paid",
      paymentStatus: "auto_executed",
      policyId: "plcy_5R1T8W3Y6B0D9F2H4K7M"
    });
    expect(delegateRows).toEqual([
      expect.objectContaining({
        evaluationType: "delegate_um_sla_bonus",
        umRequestId: submitted.id,
        incentiveStatus: "paid",
        paymentStatus: "auto_executed",
        policyId: "delegate-um-summit-pharmacy-sla-bonus-v1"
      })
    ]);
    expect(providerRow!.paymentIntentId).not.toBe(delegateRows[0]!.paymentIntentId);
    expect(executePolicyBoundPaymentMock).not.toHaveBeenCalled();
  });

  it("settles the policy payment from a completed DTR questionnaire response with yes and no answers", async () => {
    const workflow = createProviderDocumentationWorkflow();
    const questionnaire = getDtrQuestionnaire("knee-mri-pa-dtr-v1");

    const submitted = await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtrQuestionnaireResponse: {
        questionnaireId: "knee-mri-pa-dtr-v1",
        answers:
          questionnaire?.questions.map((question, index) => ({
            questionId: question.id,
            value: index === 1 ? "no" : "yes"
          })) ?? []
      }
    });
    const rows = await workflow.listIncentiveRows();

    expect(submitted.dtr).toBeNull();
    expect(submitted.dtrQuestionnaireResponse).toMatchObject({
      questionnaireId: "knee-mri-pa-dtr-v1",
      answers: expect.arrayContaining([
        expect.objectContaining({ questionId: "clinical_indication", value: "no" })
      ])
    });
    expect(rows[0]).toMatchObject({
      caseId: submitted.caseId,
      incentiveStatus: "paid",
      paymentStatus: "auto_executed",
      reason: "Completed requested DTR"
    });
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledTimes(1);
  });

  it("uses the current policy store document for each submitted PA", async () => {
    const policyStore = createInMemoryPolicyStore(defaultIncentivePolicies);
    const workflow = createProviderDocumentationWorkflow(undefined, undefined, policyStore);

    const first = await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    await policyStore.savePolicy({
      ...defaultIncentivePolicies.provider_documentation_acme_outpatient,
      payout: {
        ...defaultIncentivePolicies.provider_documentation_acme_outpatient.payout,
        amountPerEligibleRequest: 2
      }
    });
    const second = await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });

    await expect(workflow.getIncentiveRow(first.caseId)).resolves.toMatchObject({
      incentiveValue: 3,
      currency: "HBAR"
    });
    await expect(workflow.getIncentiveRow(second.caseId)).resolves.toMatchObject({
      incentiveValue: 2,
      currency: "HBAR"
    });
  });

  it("blocks auto-settlement when multiple active policies approve the same PA", async () => {
    const duplicatePolicy = {
      ...defaultIncentivePolicies.provider_documentation_acme_outpatient,
      policyId: "plcy_duplicate_approved_policy",
      payout: {
        ...defaultIncentivePolicies.provider_documentation_acme_outpatient.payout,
        amountPerEligibleRequest: 3
      }
    };
    const policyStore = createInMemoryPolicyStore({
      provider_documentation_acme_outpatient: defaultIncentivePolicies.provider_documentation_acme_outpatient,
      duplicatePolicy
    });
    const workflow = createProviderDocumentationWorkflow(undefined, undefined, policyStore);

    const submitted = await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const row = await workflow.getIncentiveRow(submitted.caseId);

    expect(row).toMatchObject({
      incentiveStatus: "not_eligible",
      paymentStatus: "blocked_by_policy",
      businessPolicyStatus: "rejected",
      paymentPolicyStatus: "blocked",
      incentiveValue: 0,
      reasonCodes: ["MULTIPLE_POLICY_MATCHES"]
    });
    expect(executePolicyBoundPaymentMock).not.toHaveBeenCalled();
  });

  it("marks the incentive as payment failed when Hedera plan controls reject an approved payout above the request max", async () => {
    executePolicyBoundPaymentMock.mockRejectedValueOnce(new Error("HEDERA_PAYMENT_AMOUNT_EXCEEDS_PLAN_MAX"));
    const paymentPolicyEvidenceStore = createCapturingPaymentPolicyEvidenceStore();
    const policyStore = createInMemoryPolicyStore({
      provider_documentation_summit_outpatient: {
        ...defaultIncentivePolicies.provider_documentation_summit_outpatient,
        payout: {
          ...defaultIncentivePolicies.provider_documentation_summit_outpatient.payout,
          amountPerEligibleRequest: 20
        }
      }
    });

    const workflow = createProviderDocumentationWorkflow(
      undefined,
      undefined,
      policyStore,
      undefined,
      undefined,
      paymentPolicyEvidenceStore
    );
    const submitted = await workflow.submitPriorAuth({
      patientId: "patient-andre-williams",
      patientDisplay: "Andre Williams",
      planId: "summit-health-hmo",
      planDisplay: "Summit Health HMO",
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const row = await workflow.getIncentiveRow(submitted.caseId);
    const businessPolicyId = "plcy_9Q3S6V1X8Z2B5D7F0H4K";
    const incentiveEvaluationId = buildBusinessEvaluationId({
      umRequestId: submitted.id,
      businessPolicyId
    });
    const paymentIntentId = buildPaymentIntentId({
      umRequestId: submitted.id,
      caseId: submitted.id,
      incentiveEvaluationId,
      businessPolicyId,
      paymentPolicyId: "summit-health-hmo"
    });

    expect(row).toMatchObject({
      id: incentiveEvaluationId,
      policyId: businessPolicyId,
      businessPolicyStatus: "approved",
      paymentPolicyStatus: "blocked",
      incentiveStatus: "payment_failed",
      paymentStatus: "execution_failed",
      incentiveValue: 20,
      currency: "HBAR",
      paymentPolicyId: "summit-health-hmo",
      paymentPolicyControls: expect.arrayContaining([
        expect.objectContaining({ id: "businessEvaluationAttestation", label: "Business evaluation attestation", status: "passed" }),
        expect.objectContaining({ id: "paymentToken", label: "Payment token", status: "passed" }),
        expect.objectContaining({ id: "maxPaymentPerRequest", label: "Max payment per request", status: "failed" }),
        expect.objectContaining({ id: "duplicatePaymentPrevention", label: "Duplicate payment prevention", status: "not_run" }),
        expect.objectContaining({ id: "paymentEnvelopeIntegrity", label: "Payment envelope integrity", status: "not_run" })
      ]),
      transactionId: null,
      reason: "Policy approved, but Hedera transaction execution failed"
    });
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: "summit-health-hmo",
        amount: 20,
        currency: "HBAR",
        policyId: "plcy_9Q3S6V1X8Z2B5D7F0H4K"
      }),
      expect.objectContaining({
        planPolicy: expect.objectContaining({
          planId: "summit-health-hmo",
          maxPaymentAmount: 7
        })
      })
    );
    expect(paymentPolicyEvidenceStore.saved).toHaveLength(1);
    expect(paymentPolicyEvidenceStore.saved[0]).toMatchObject({
      incentiveEvaluationId,
      umRequestId: submitted.id,
      caseId: submitted.caseId,
      planId: "summit-health-hmo",
      paymentPolicyId: "summit-health-hmo",
      businessPolicyId,
      runtime: "hedera-agent-kit-policy",
      outcome: "blocked",
      failureCode: "HEDERA_PAYMENT_AMOUNT_EXCEEDS_PLAN_MAX",
      requestedPayment: {
        amount: 20,
        token: "HBAR",
        recipientWalletId: "0.0.9049549"
      },
      controls: expect.arrayContaining([
        expect.objectContaining({
          id: "businessEvaluationAttestation",
          status: "passed"
        }),
        expect.objectContaining({
          id: "paymentToken",
          status: "passed",
          expected: "HBAR",
          actual: "HBAR"
        }),
        expect.objectContaining({
          id: "maxPaymentPerRequest",
          status: "failed",
          expected: "<= 7 HBAR",
          actual: "20 HBAR",
          failureCode: "HEDERA_PAYMENT_AMOUNT_EXCEEDS_PLAN_MAX"
        }),
        expect.objectContaining({
          id: "duplicatePaymentPrevention",
          status: "not_run"
        }),
        expect.objectContaining({
          id: "paymentEnvelopeIntegrity",
          status: "not_run"
        })
      ]),
      paymentIntentId,
      transactionId: null
    });
    expect(paymentPolicyEvidenceStore.saved[0]!.controls.map((control) => control.id)).not.toEqual(
      expect.arrayContaining(["safeTransactionMemo", "testnetOnly"])
    );
  });

  it("persists submitted UM requests as PAS FHIR bundles", async () => {
    const storedRequests: StoredPasSubmission[] = [];
    const storedRows: IncentiveWorklistRow[] = [];
    const savePriorAuth = vi.fn();
    const workflow = createProviderDocumentationWorkflow(undefined, {
      backend: "firestore",
      async savePasSubmission(request) {
        storedRequests.push(request);
      },
      savePriorAuth,
      async saveUmRequest() {
        return undefined;
      },
      async listUmRequests() {
        return storedRequests.map((request) => request.umRequest);
      },
      async getUmRequest(umRequestId) {
        return storedRequests.find((request) => request.umRequest.id === umRequestId)?.umRequest ?? null;
      },
      async listUmEvents() {
        return storedRequests.flatMap((request) => [
          {
            eventType: "PAS_SUBMITTED" as const,
            caseId: request.umRequest.id,
            umRequestId: request.umRequest.id
          },
          {
            eventType: "UM_REQUEST_CREATED" as const,
            caseId: request.umRequest.id,
            umRequestId: request.umRequest.id
          }
        ]);
      },
      async listPriorAuthRecords() {
        return storedRequests.map((request) => request.umRequest);
      },
      async getPriorAuthRecord(caseId) {
        return storedRequests.find((request) => request.umRequest.id === caseId)?.umRequest ?? null;
      },
      async getEvidence(umRequestId) {
        return storedRequests.find((request) => request.umRequest.id === umRequestId)?.evidence ?? null;
      },
      async listPasEvents() {
        return storedRequests.map((request) => ({
          eventType: "PAS_SUBMITTED",
          caseId: request.umRequest.id,
          umRequestId: request.umRequest.id
        }));
      },
      async saveIncentiveRow(row) {
        storedRows.push(row);
      },
      async listIncentiveRows() {
        return storedRows;
      },
      async getIncentiveRow(umRequestId) {
        return storedRows.find((row) => row.umRequestId === umRequestId) ?? null;
      }
    });

    const submitted = await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });

    await expect(workflow.listUmRequests()).resolves.toEqual([expect.objectContaining({ id: submitted.id })]);
    await expect(workflow.listPriorAuths()).resolves.toEqual([expect.objectContaining({ id: submitted.id })]);
    await expect(workflow.getEvidence(submitted.id)).resolves.toMatchObject({
      id: submitted.id,
      umRequestId: submitted.id,
      caseId: submitted.id
    });
    const storedRow = storedRows.find((row) => row.umRequestId === submitted.id);
    expect(storedRow).toMatchObject({
      id: buildBusinessEvaluationId({
        umRequestId: submitted.id,
        businessPolicyId: storedRow!.policyId
      }),
      umRequestId: submitted.id,
      caseId: submitted.id
    });
    expect(savePriorAuth).not.toHaveBeenCalled();
    expect(storedRequests[0]).toMatchObject({
      umRequest: { id: submitted.id, caseId: submitted.id },
      evidence: { id: submitted.id, umRequestId: submitted.id, caseId: submitted.id },
      fhirBundle: {
        id: submitted.id,
        resourceType: "Bundle",
        entry: expect.arrayContaining([
          expect.objectContaining({ resource: expect.objectContaining({ resourceType: "Claim", id: submitted.id }) })
        ])
      }
    });
  });

  it("skips persisted case-id collisions when the local sequence restarts", async () => {
    const collisionCaseIds = [
      "PA-260524-2102-AAAA1111",
      "PA-260524-2102-BBBB2222",
      "PA-260524-2102-CCCC3333"
    ];
    const previousPlatform = createInMemoryUmPlatform({ generateCaseId: createCaseIdGenerator(collisionCaseIds.slice(0, 2)) });
    const existingKnee = previousPlatform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });
    const existingFullBody = previousPlatform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "full_body_wellness_mri",
      acknowledgedNotCovered: true
    });
    const storedRequests: StoredPasSubmission[] = [existingKnee, existingFullBody].map((umRequest) => ({
      umRequest,
      evidence: previousPlatform.getEvidence(umRequest.id)!,
      fhirBundle: buildPasFhirBundle(umRequest, previousPlatform.getEvidence(umRequest.id)!)
    }));
    const workflow = createProviderDocumentationWorkflow(createInMemoryUmPlatform({ generateCaseId: createCaseIdGenerator(collisionCaseIds) }), {
      backend: "firestore",
      async savePasSubmission(request) {
        storedRequests.push(request);
      },
      async savePriorAuth(request) {
        storedRequests.push({
          umRequest: request.record,
          evidence: request.evidence,
          fhirBundle: request.fhirBundle
        });
      },
      async saveUmRequest() {
        return undefined;
      },
      async listUmRequests() {
        return storedRequests.map((request) => request.umRequest);
      },
      async getUmRequest(umRequestId) {
        return storedRequests.find((request) => request.umRequest.id === umRequestId)?.umRequest ?? null;
      },
      async listUmEvents() {
        return storedRequests.flatMap((request) => [
          { eventType: "PAS_SUBMITTED" as const, caseId: request.umRequest.id, umRequestId: request.umRequest.id },
          { eventType: "UM_REQUEST_CREATED" as const, caseId: request.umRequest.id, umRequestId: request.umRequest.id }
        ]);
      },
      async listPriorAuthRecords() {
        return storedRequests.map((request) => request.umRequest);
      },
      async getPriorAuthRecord(caseId) {
        return storedRequests.find((request) => request.umRequest.id === caseId)?.umRequest ?? null;
      },
      async getEvidence(umRequestId) {
        return storedRequests.find((request) => request.evidence.umRequestId === umRequestId)?.evidence ?? null;
      },
      async listPasEvents() {
        return storedRequests.map((request) => ({
          eventType: "PAS_SUBMITTED",
          caseId: request.umRequest.id,
          umRequestId: request.umRequest.id
        }));
      },
      async saveIncentiveRow() {
        return undefined;
      },
      async listIncentiveRows() {
        return [];
      },
      async getIncentiveRow() {
        return null;
      }
    });

    const submitted = await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });

    expect(submitted.caseId).toBe("PA-260524-2102-CCCC3333");
    expect(storedRequests.map((request) => request.umRequest.id)).toEqual(collisionCaseIds);
  });

  it("reprocesses a stale incentive row when a newer UM request uses the same canonical ID", async () => {
    const platform = createInMemoryUmPlatform();
    const record = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const evidence = platform.getEvidence(record.id)!;
    const storedRequest: StoredPasSubmission = {
      umRequest: record,
      evidence,
      fhirBundle: buildPasFhirBundle(record, evidence)
    };
    let incentiveRow: IncentiveWorklistRow | null = {
      id: record.id,
      umRequestId: record.id,
      caseId: record.id,
      submittedAt: "2026-05-24T00:00:00.000Z",
      providerGroupDisplay: record.providerGroupDisplay,
      requestType: record.requestType,
      serviceLabel: record.serviceLabel,
      serviceCode: record.serviceCode,
      state: record.state,
      outcomeStatus: null,
      businessPolicyStatus: "rejected",
      paymentPolicyStatus: "blocked",
      incentiveStatus: "not_eligible",
      paymentStatus: "blocked_by_policy",
      incentiveValue: 0,
      currency: "USDC",
      settlementToken: { symbol: "USDC" },
      reason: "Old stale evaluation",
      reasonCodes: ["DTR_TEMPLATE_INCOMPLETE"],
      policyId: "provider-documentation-completeness-v1",
      policyControls: [],
      policyCriteria: [],
      audit: {
        id: "audit-stale",
        requestHash: "hash-stale",
        policyId: "provider-documentation-completeness-v1",
        policyVersion: "v1",
        decision: "blocked",
        reasonCodes: ["DTR_TEMPLATE_INCOMPLETE"],
        transactionId: null,
        createdAt: "2026-05-24T00:00:00.000Z"
      },
      walletId: null,
      paymentIntentId: null,
      transactionId: null,
      paymentPolicyId: null,
      paymentPolicyControls: []
    };
    const workflow = createProviderDocumentationWorkflow(createInMemoryUmPlatform(), {
      backend: "firestore",
      async savePasSubmission() {
        return undefined;
      },
      async savePriorAuth() {
        return undefined;
      },
      async saveUmRequest() {
        return undefined;
      },
      async listUmRequests() {
        return [storedRequest.umRequest];
      },
      async getUmRequest(umRequestId) {
        return umRequestId === record.id ? storedRequest.umRequest : null;
      },
      async listUmEvents() {
        return [
          { eventType: "PAS_SUBMITTED", caseId: record.id, umRequestId: record.id },
          { eventType: "UM_REQUEST_CREATED", caseId: record.id, umRequestId: record.id }
        ];
      },
      async listPriorAuthRecords() {
        return [storedRequest.umRequest];
      },
      async getPriorAuthRecord(caseId) {
        return caseId === record.id ? storedRequest.umRequest : null;
      },
      async getEvidence(umRequestId) {
        return umRequestId === record.id ? storedRequest.evidence : null;
      },
      async listPasEvents() {
        return [{ eventType: "PAS_SUBMITTED", caseId: record.id, umRequestId: record.id }];
      },
      async saveIncentiveRow(row) {
        incentiveRow = row;
      },
      async listIncentiveRows() {
        return incentiveRow ? [incentiveRow] : [];
      },
      async getIncentiveRow(umRequestId) {
        return umRequestId === record.id ? incentiveRow : null;
      }
    });

    const rows = await workflow.listIncentiveRows();

    expect(rows[0]).toMatchObject({
      id: buildBusinessEvaluationId({
        umRequestId: record.id,
        businessPolicyId: rows[0]!.policyId
      }),
      umRequestId: record.id,
      caseId: record.id,
      submittedAt: record.submittedAt,
      incentiveStatus: "paid",
      paymentStatus: "auto_executed",
      currency: "HBAR",
      settlementToken: { symbol: "HBAR" },
      reasonCodes: []
    });
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledTimes(1);
  });

  it("reprocesses a current-timestamp row when canonical UM documentation changes", async () => {
    const platform = createInMemoryUmPlatform();
    const record = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });
    const initialEvidence = platform.getEvidence(record.id)!;
    let storedRequest: StoredPasSubmission = {
      umRequest: record,
      evidence: initialEvidence,
      fhirBundle: buildPasFhirBundle(record, initialEvidence)
    };
    let incentiveRow: IncentiveWorklistRow | null = {
      id: record.id,
      umRequestId: record.id,
      caseId: record.id,
      submittedAt: record.submittedAt,
      providerGroupDisplay: record.providerGroupDisplay,
      requestType: record.requestType,
      serviceLabel: record.serviceLabel,
      serviceCode: record.serviceCode,
      state: record.state,
      outcomeStatus: record.outcomeStatus,
      businessPolicyStatus: "rejected",
      paymentPolicyStatus: "blocked",
      incentiveStatus: "not_eligible",
      paymentStatus: "blocked_by_policy",
      incentiveValue: 0,
      currency: "HBAR",
      settlementToken: { symbol: "HBAR" },
      reason: "Requested DTR incomplete",
      reasonCodes: ["DTR_TEMPLATE_INCOMPLETE"],
      policyId: "provider-documentation-completeness-v1",
      policyControls: [],
      policyCriteria: [
        {
          id: "dtrTemplateCompleted",
          label: "Requested DTR is complete",
          expected: "true",
          actual: "false",
          passed: false,
          reasonCode: "DTR_TEMPLATE_INCOMPLETE"
        }
      ],
      audit: {
        id: "audit-current-stale",
        requestHash: "hash-current-stale",
        policyId: "provider-documentation-completeness-v1",
        policyVersion: "v1",
        decision: "blocked",
        reasonCodes: ["DTR_TEMPLATE_INCOMPLETE"],
        transactionId: null,
        createdAt: record.submittedAt
      },
      walletId: null,
      paymentIntentId: null,
      transactionId: null,
      paymentPolicyId: null,
      paymentPolicyControls: []
    };
    const persistence: UmPasPersistenceStore = {
      backend: "firestore" as const,
      async savePasSubmission(request: StoredPasSubmission) {
        storedRequest = request;
      },
      async savePriorAuth(request) {
        storedRequest = {
          umRequest: request.record,
          evidence: request.evidence,
          fhirBundle: request.fhirBundle
        };
      },
      async saveUmRequest(umRequest) {
        storedRequest = {
          ...storedRequest,
          umRequest
        };
      },
      async listUmRequests() {
        return [storedRequest.umRequest];
      },
      async getUmRequest(umRequestId: string) {
        return umRequestId === record.id ? storedRequest.umRequest : null;
      },
      async listUmEvents() {
        return [{ eventType: "UM_REQUEST_CREATED" as const, caseId: record.id, umRequestId: record.id }];
      },
      async listPriorAuthRecords() {
        return [storedRequest.umRequest];
      },
      async getPriorAuthRecord(caseId: string) {
        return caseId === record.id ? storedRequest.umRequest : null;
      },
      async getEvidence(umRequestId: string) {
        return umRequestId === record.id ? storedRequest.evidence : null;
      },
      async listPasEvents() {
        return [];
      },
      async saveIncentiveRow(row: IncentiveWorklistRow) {
        incentiveRow = row;
      },
      async listIncentiveRows() {
        return incentiveRow ? [incentiveRow] : [];
      },
      async getIncentiveRow(umRequestId: string) {
        return umRequestId === record.id ? incentiveRow : null;
      }
    };
    const workflow = createProviderDocumentationWorkflow(createInMemoryUmPlatform(), persistence);

    await persistence.saveUmRequest({
      ...record,
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const rows = await workflow.listIncentiveRows();

    expect(rows[0]).toMatchObject({
      id: buildBusinessEvaluationId({
        umRequestId: record.id,
        businessPolicyId: rows[0]!.policyId
      }),
      umRequestId: record.id,
      submittedAt: record.submittedAt,
      incentiveStatus: "paid",
      paymentStatus: "auto_executed",
      incentiveValue: 3,
      reason: "Completed requested DTR",
      reasonCodes: []
    });
    expect(rows[0]!.policyCriteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "dtrTemplateCompleted",
          actual: "true",
          passed: true
        })
      ])
    );
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledTimes(1);
  });

  it("preserves paid payment fields when only UM lifecycle display fields change", async () => {
    const platform = createInMemoryUmPlatform();
    const record = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const evidence = platform.getEvidence(record.id)!;
    const storedRequest: StoredPasSubmission = {
      umRequest: record,
      evidence,
      fhirBundle: buildPasFhirBundle(record, evidence)
    };
    let incentiveRow: IncentiveWorklistRow | null = null;
    const savedRows: IncentiveWorklistRow[] = [];
    const persistence: UmPasPersistenceStore = {
      backend: "firestore",
      async savePasSubmission() {
        return undefined;
      },
      async savePriorAuth() {
        return undefined;
      },
      async saveUmRequest(umRequest) {
        storedRequest.umRequest = umRequest;
      },
      async listUmRequests() {
        return [storedRequest.umRequest];
      },
      async getUmRequest(umRequestId) {
        return umRequestId === record.id ? storedRequest.umRequest : null;
      },
      async listUmEvents() {
        return [{ eventType: "UM_REQUEST_CREATED", caseId: record.id, umRequestId: record.id }];
      },
      async listPriorAuthRecords() {
        return [storedRequest.umRequest];
      },
      async getPriorAuthRecord(caseId) {
        return caseId === record.id ? storedRequest.umRequest : null;
      },
      async getEvidence(umRequestId) {
        return umRequestId === record.id ? storedRequest.evidence : null;
      },
      async listPasEvents() {
        return [];
      },
      async saveIncentiveRow(row) {
        incentiveRow = row;
        savedRows.push(row);
      },
      async listIncentiveRows() {
        return incentiveRow ? [incentiveRow] : [];
      },
      async getIncentiveRow(umRequestId) {
        return umRequestId === record.id ? incentiveRow : null;
      }
    };
    const workflow = createProviderDocumentationWorkflow(createInMemoryUmPlatform(), persistence);

    const [paidRow] = await workflow.listIncentiveRows();
    expect(savedRows).toHaveLength(2);
    incentiveRow = {
      ...incentiveRow!,
      umEvidenceSignature: JSON.stringify({
        id: record.id,
        planId: record.planId,
        providerId: record.providerId,
        requestType: record.requestType,
        serviceCode: record.serviceCode,
        codingSystem: record.codingSystem,
        billingCode: record.billingCode,
        coveredBenefit: true,
        dtrRequested: true,
        dtrCompleted: true,
        state: record.state,
        outcomeStatus: record.outcomeStatus
      })
    };
    await persistence.saveUmRequest({
      ...record,
      state: "determined",
      outcomeStatus: "denied",
      determinedAt: record.submittedAt
    });
    const restartedWorkflow = createProviderDocumentationWorkflow(createInMemoryUmPlatform(), persistence);
    const [updatedRow] = await restartedWorkflow.listIncentiveRows();

    expect(updatedRow).toMatchObject({
      id: paidRow!.id,
      umRequestId: record.id,
      state: paidRow!.state,
      outcomeStatus: paidRow!.outcomeStatus,
      incentiveStatus: "paid",
      paymentStatus: "auto_executed",
      incentiveValue: 3,
      paymentIntentId: paidRow!.paymentIntentId,
      transactionId: paidRow!.transactionId
    });
    expect(updatedRow!.audit.transactionId).toBe(paidRow!.audit.transactionId);
    expect(savedRows).toHaveLength(2);
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledTimes(1);
  });

  it("ignores persisted delegate UM rows in the provider documentation worklist", async () => {
    const delegateRow = {
      evaluationType: "delegate_um_sla_bonus",
      umRequestId: "PA-260526-0900-DELEGATE",
      id: "PA-260526-0900-DELEGATE",
      caseId: "PA-260526-0900-DELEGATE",
      planId: "acme-health-ppo",
      planDisplay: "Acme Health PPO",
      delegateVendorId: "northstar-um",
      requestType: "pharmacy_benefit",
      serviceLabel: "Wegovy (semaglutide) injection",
      submittedAt: "2026-05-26T09:00:00.000Z",
      pendStartedAt: "2026-05-26T09:00:00.000Z",
      slaDeadlineAt: "2026-05-27T09:00:00.000Z",
      determinedAt: "2026-05-26T10:00:00.000Z",
      timeRemainingMs: 0,
      state: "determined",
      outcomeStatus: "approved",
      slaStatus: "within_sla",
      incentiveStatus: "paid",
      paymentStatus: "auto_executed",
      incentiveValue: 3,
      currency: "HBAR",
      settlementToken: { symbol: "HBAR" },
      reason: "Determination completed within SLA",
      reasonCodes: [],
      policyId: "delegate-um-sla-bonus-v1",
      audit: {
        id: "audit-delegate-row",
        requestHash: "hash-delegate-row",
        policyId: "delegate-um-sla-bonus-v1",
        policyVersion: "v1",
        decision: "approved",
        reasonCodes: [],
        transactionId: "testnet-delegate-row",
        createdAt: "2026-05-26T10:00:00.000Z"
      },
      walletId: "0.0.9049549",
      paymentIntentId: "PA-260526-0900-DELEGATE",
      transactionId: "testnet-delegate-row"
    };
    const persistence: UmPasPersistenceStore = {
      backend: "firestore" as const,
      async savePasSubmission() {
        throw new Error("TEST_UNEXPECTED_SAVE");
      },
      async savePriorAuth() {
        throw new Error("TEST_UNEXPECTED_SAVE");
      },
      async saveUmRequest() {
        throw new Error("TEST_UNEXPECTED_SAVE");
      },
      async listUmRequests() {
        return [];
      },
      async getUmRequest() {
        return null;
      },
      async listUmEvents() {
        return [];
      },
      async listPriorAuthRecords() {
        return [];
      },
      async getPriorAuthRecord() {
        return null;
      },
      async getEvidence() {
        return null;
      },
      async listPasEvents() {
        return [];
      },
      async saveIncentiveRow() {
        throw new Error("TEST_UNEXPECTED_SAVE");
      },
      async listIncentiveRows() {
        return [delegateRow as unknown as IncentiveWorklistRow];
      },
      async getIncentiveRow() {
        return delegateRow as unknown as IncentiveWorklistRow;
      }
    };
    const workflow = createProviderDocumentationWorkflow(createInMemoryUmPlatform(), persistence);

    await expect(workflow.listIncentiveRows()).resolves.toEqual([]);
  });

  it("keeps paid rows immutable when canonical UM documentation evidence later becomes ineligible", async () => {
    const platform = createInMemoryUmPlatform();
    const record = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const evidence = platform.getEvidence(record.id)!;
    const storedRequest: StoredPasSubmission = {
      umRequest: record,
      evidence,
      fhirBundle: buildPasFhirBundle(record, evidence)
    };
    let incentiveRow: IncentiveWorklistRow | null = null;
    const savedRows: IncentiveWorklistRow[] = [];
    const persistence: UmPasPersistenceStore = {
      backend: "firestore",
      async savePasSubmission() {
        return undefined;
      },
      async savePriorAuth() {
        return undefined;
      },
      async saveUmRequest(umRequest) {
        storedRequest.umRequest = umRequest;
      },
      async listUmRequests() {
        return [storedRequest.umRequest];
      },
      async getUmRequest(umRequestId) {
        return umRequestId === record.id ? storedRequest.umRequest : null;
      },
      async listUmEvents() {
        return [{ eventType: "UM_REQUEST_CREATED", caseId: record.id, umRequestId: record.id }];
      },
      async listPriorAuthRecords() {
        return [storedRequest.umRequest];
      },
      async getPriorAuthRecord(caseId) {
        return caseId === record.id ? storedRequest.umRequest : null;
      },
      async getEvidence(umRequestId) {
        return umRequestId === record.id ? storedRequest.evidence : null;
      },
      async listPasEvents() {
        return [];
      },
      async saveIncentiveRow(row) {
        incentiveRow = row;
        savedRows.push(row);
      },
      async listIncentiveRows() {
        return incentiveRow ? [incentiveRow] : [];
      },
      async getIncentiveRow(umRequestId) {
        return umRequestId === record.id ? incentiveRow : null;
      }
    };
    const workflow = createProviderDocumentationWorkflow(createInMemoryUmPlatform(), persistence);

    const [paidRow] = await workflow.listIncentiveRows();
    expect(savedRows).toHaveLength(2);
    await persistence.saveUmRequest({
      ...record,
      dtr: null,
      documentation: {
        ...record.documentation,
        dtrCompleted: false,
        attachmentChecklistComplete: false,
        fhirFieldsPresent: false
      }
    });
    const restartedWorkflow = createProviderDocumentationWorkflow(createInMemoryUmPlatform(), persistence);
    const [immutableRow] = await restartedWorkflow.listIncentiveRows();

    expect(immutableRow).toMatchObject({
      id: paidRow!.id,
      umRequestId: record.id,
      serviceCode: "knee_mri",
      state: paidRow!.state,
      outcomeStatus: paidRow!.outcomeStatus,
      incentiveStatus: "paid",
      paymentStatus: "auto_executed",
      incentiveValue: 3,
      reason: "Completed requested DTR",
      reasonCodes: [],
      paymentIntentId: paidRow!.paymentIntentId,
      transactionId: paidRow!.transactionId
    });
    expect(incentiveRow).toMatchObject({
      incentiveStatus: "paid",
      paymentStatus: "auto_executed",
      transactionId: paidRow!.transactionId
    });
    expect(savedRows).toHaveLength(2);
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledTimes(1);
  });

  it("blocks from canonical UM request fields when persisted evidence is stale and would approve", async () => {
    const platform = createInMemoryUmPlatform();
    const record = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "full_body_wellness_mri",
      acknowledgedNotCovered: true
    });
    const canonicalEvidence = platform.getEvidence(record.id)!;
    const staleApprovedEvidence = {
      ...canonicalEvidence,
      serviceCode: "knee_mri" as const,
      billingCode: "73721",
      coveredBenefit: true,
      crdCoveredBenefit: true,
      dtrRequested: true,
      dtrCompleted: true,
      dtrTemplateCompleted: true,
      attachmentChecklistComplete: true,
      fhirFieldsPresent: true
    };
    const storedRequest: StoredPasSubmission = {
      umRequest: record,
      evidence: staleApprovedEvidence,
      fhirBundle: buildPasFhirBundle(record, canonicalEvidence)
    };
    let incentiveRow: IncentiveWorklistRow | null = null;
    const workflow = createProviderDocumentationWorkflow(createInMemoryUmPlatform(), {
      backend: "firestore",
      async savePasSubmission() {
        return undefined;
      },
      async savePriorAuth() {
        return undefined;
      },
      async saveUmRequest() {
        return undefined;
      },
      async listUmRequests() {
        return [storedRequest.umRequest];
      },
      async getUmRequest(umRequestId) {
        return umRequestId === record.id ? storedRequest.umRequest : null;
      },
      async listUmEvents() {
        return [{ eventType: "UM_REQUEST_CREATED", caseId: record.id, umRequestId: record.id }];
      },
      async listPriorAuthRecords() {
        return [storedRequest.umRequest];
      },
      async getPriorAuthRecord(caseId) {
        return caseId === record.id ? storedRequest.umRequest : null;
      },
      async getEvidence(umRequestId) {
        return umRequestId === record.id ? storedRequest.evidence : null;
      },
      async listPasEvents() {
        return [];
      },
      async saveIncentiveRow(row) {
        incentiveRow = row;
      },
      async listIncentiveRows() {
        return incentiveRow ? [incentiveRow] : [];
      },
      async getIncentiveRow(umRequestId) {
        return umRequestId === record.id ? incentiveRow : null;
      }
    });

    await expect(workflow.getEvidence(record.id)).resolves.toMatchObject({
      id: record.id,
      umRequestId: record.id,
      caseId: record.id,
      serviceCode: "full_body_wellness_mri",
      coveredBenefit: false,
      dtrCompleted: false,
      dtrTemplateCompleted: false
    });

    const rows = await workflow.listIncentiveRows();

    expect(rows[0]).toMatchObject({
      id: buildBusinessEvaluationId({
        umRequestId: record.id,
        businessPolicyId: rows[0]!.policyId
      }),
      umRequestId: record.id,
      caseId: record.id,
      serviceCode: "full_body_wellness_mri",
      incentiveStatus: "not_eligible",
      paymentStatus: "blocked_by_policy",
      incentiveValue: 0,
      reason: "Non-covered benefit",
      reasonCodes: expect.arrayContaining(["BENEFIT_NOT_COVERED"])
    });
    expect(rows[0]!.policyCriteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Request is a covered benefit",
          actual: "false",
          passed: false
        })
      ])
    );
    expect(executePolicyBoundPaymentMock).not.toHaveBeenCalled();
  });

  it("does not block provider submission when incentive evidence processing is unavailable", async () => {
    const platform = createInMemoryUmPlatform();
    const workflow = createProviderDocumentationWorkflow({
      ...platform,
      getEvidence() {
        throw new Error("INCENTIVE_EVIDENCE_UNAVAILABLE");
      }
    });

    const submitted = await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });

    expect(submitted.caseId).toMatch(PA_CASE_ID_PATTERN);
    await expect(workflow.listPriorAuths()).resolves.toHaveLength(1);
  });

  it("logs but does not surface async incentive processing failures during submission", async () => {
    const platform = createInMemoryUmPlatform();
    const throwingPolicyStore = {
      backend: "memory" as const,
      async findPolicies() {
        throw new Error("POLICY_STORE_UNAVAILABLE");
      },
      async getPolicy() {
        return null;
      },
      async listPolicies() {
        return [];
      },
      async savePolicy() {}
    } as unknown as Parameters<typeof createProviderDocumentationWorkflow>[2];
    const workflow = createProviderDocumentationWorkflow(platform, undefined, throwingPolicyStore);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const submitted = await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });

    expect(submitted.caseId).toMatch(PA_CASE_ID_PATTERN);
    await expect(workflow.listPriorAuths()).resolves.toHaveLength(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("PROVIDER_DOCUMENTATION_INCENTIVE_PROCESSING_FAILED")
    );
    errorSpy.mockRestore();
  });

  it("submits full-body wellness MRI and creates a zero-value blocked policy row", async () => {
    const workflow = createProviderDocumentationWorkflow();

    await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "full_body_wellness_mri",
      acknowledgedNotCovered: true
    });
    const rows = await workflow.listIncentiveRows();

    expect(rows[0]).toMatchObject({
      serviceLabel: "Full-body wellness MRI screening",
      incentiveStatus: "not_eligible",
      paymentStatus: "blocked_by_policy",
      incentiveValue: 0,
      currency: "HBAR",
      reason: "Non-covered benefit"
    });
    expect(rows[0]!.transactionId).toBeNull();
    expect(rows[0]!.policyCriteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Request is a covered benefit",
          expected: "true",
          actual: "false",
          passed: false,
          reasonCode: "BENEFIT_NOT_COVERED"
        })
      ])
    );
    expect(executePolicyBoundPaymentMock).not.toHaveBeenCalled();
  });

  it("submits pharmacy medication requests and settles eligible request-type policy payment", async () => {
    const workflow = createProviderDocumentationWorkflow();

    await workflow.submitPriorAuth({
      requestType: "pharmacy_benefit",
      serviceCode: "humira_adalimumab",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const rows = await workflow.listIncentiveRows();

    expect(rows[0]).toMatchObject({
      requestType: "pharmacy_benefit",
      serviceLabel: "Humira (adalimumab) Pen",
      serviceCode: "humira_adalimumab",
      incentiveStatus: "paid",
      paymentStatus: "auto_executed"
    });
    expect(rows[0]!.policyCriteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Request type is eligible",
          expected: "Pharmacy Benefit",
          actual: "Pharmacy Benefit",
          passed: true,
          reasonCode: "REQUEST_TYPE_NOT_ELIGIBLE"
        })
      ])
    );
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledTimes(1);
  });

  it("settles Summit Health HMO pharmacy requests through the matching plan and request-type policy", async () => {
    const workflow = createProviderDocumentationWorkflow();

    await workflow.submitPriorAuth({
      planId: "summit-health-hmo",
      requestType: "pharmacy_benefit",
      serviceCode: "wegovy_semaglutide",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const rows = await workflow.listIncentiveRows();

    expect(rows[0]).toMatchObject({
      requestType: "pharmacy_benefit",
      serviceLabel: "Wegovy (semaglutide) injection",
      incentiveStatus: "paid",
      paymentStatus: "auto_executed",
      policyId: "plcy_5R1T8W3Y6B0D9F2H4K7M",
      incentiveValue: 6
    });
    expect(rows[0]!.policyCriteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Request type is eligible",
          expected: "Pharmacy Benefit",
          actual: "Pharmacy Benefit",
          passed: true
        }),
        expect.objectContaining({
          label: "Service code is included",
          expected: "0169-4525-14, 0074-0554-02",
          actual: "0169-4525-14",
          passed: true
        })
      ])
    );
    expectNoImplementationGuardrailCriteria(rows[0]!);
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledTimes(1);
  });

  it("submits knee MRI with skipped assessment as zero-value blocked policy row", async () => {
    const workflow = createProviderDocumentationWorkflow();

    const submitted = await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });
    const rows = await workflow.listIncentiveRows();

    expect(submitted).toMatchObject({
      state: "pend",
      outcomeStatus: null
    });
    expect(submitted).not.toHaveProperty("paResult");
    expect(submitted).not.toHaveProperty("denialReason");
    expect(submitted.caseId).toMatch(PA_CASE_ID_PATTERN);
    expect(rows[0]).toMatchObject({
      caseId: submitted.caseId,
      serviceLabel: "Knee MRI after injury",
      incentiveStatus: "not_eligible",
      paymentStatus: "blocked_by_policy",
      incentiveValue: 0,
      reason: "Requested DTR incomplete"
    });
    expect(rows[0]!.reasonCodes).toEqual(["DTR_TEMPLATE_INCOMPLETE"]);
  });

  it("preserves audit metadata across repeated list and get reads", async () => {
    const workflow = createProviderDocumentationWorkflow();

    const submitted = await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const listed = (await workflow.listIncentiveRows())[0];
    await new Promise((resolve) => setTimeout(resolve, 5));
    const relisted = (await workflow.listIncentiveRows())[0];
    const fetched = await workflow.getIncentiveRow(submitted.caseId);

    expect(relisted.audit.createdAt).toBe(listed.audit.createdAt);
    expect(fetched?.audit.createdAt).toBe(listed.audit.createdAt);
    expect(relisted.transactionId).toBe(listed.transactionId);
    expect(fetched?.transactionId).toBe(listed.transactionId);
  });

  it("does not execute duplicate payments across repeated incentive reads", async () => {
    const workflow = createProviderDocumentationWorkflow();

    const submitted = await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const firstPaid = await workflow.getIncentiveRow(submitted.caseId);
    const secondPaid = await workflow.getIncentiveRow(submitted.caseId);

    expect(secondPaid?.transactionId).toBe(firstPaid?.transactionId);
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledTimes(1);
  });
});

function createCapturingPaymentPolicyEvidenceStore(): PaymentPolicyEvidenceStore & { saved: PaymentPolicyEvidence[] } {
  const saved: PaymentPolicyEvidence[] = [];

  return {
    backend: "firestore",
    saved,
    async saveEvidence(evidence) {
      saved.push(evidence);
    },
    async getEvidence(incentiveEvaluationId) {
      return saved.find((evidence) => evidence.incentiveEvaluationId === incentiveEvaluationId) ?? null;
    }
  };
}

function createCaseIdGenerator(caseIds: string[]): () => string {
  let nextIndex = 0;

  return () => {
    const caseId = caseIds[nextIndex];
    nextIndex += 1;

    if (!caseId) {
      throw new Error("CASE_ID_SEQUENCE_EXHAUSTED");
    }

    return caseId;
  };
}

class FakeMixedPasPersistenceStore implements UmPasPersistenceStore {
  readonly backend = "firestore" as const;
  private readonly requests = new Map<string, UMRequest>();
  private readonly submissions = new Map<string, StoredPasSubmission>();
  private readonly rows = new Map<string, PersistedIncentiveWorklistRow>();
  private rowOrder: string[] = [];

  async savePasSubmission(request: StoredPasSubmission): Promise<void> {
    this.submissions.set(request.umRequest.id, structuredClone(request));
    await this.saveUmRequest(request.umRequest);
  }

  async savePriorAuth(request: { record: UMRequest }): Promise<void> {
    const evidence = buildProviderDocumentationEvidence(request.record);
    await this.savePasSubmission({
      umRequest: request.record,
      evidence,
      fhirBundle: buildPasFhirBundle(request.record, evidence)
    });
  }

  async saveUmRequest(umRequest: UMRequest): Promise<void> {
    this.requests.set(umRequest.id, structuredClone(umRequest));
    const existing = this.submissions.get(umRequest.id);
    if (existing) {
      this.submissions.set(umRequest.id, {
        ...existing,
        umRequest: structuredClone(umRequest)
      });
    }
  }

  async listUmRequests(): Promise<UMRequest[]> {
    return [...this.requests.values()].map((request) => structuredClone(request));
  }

  async getUmRequest(umRequestId: string): Promise<UMRequest | null> {
    const request = this.requests.get(umRequestId);
    return request ? structuredClone(request) : null;
  }

  async listUmEvents() {
    return [...this.requests.values()].flatMap((request) => [
      { eventType: "PAS_SUBMITTED" as const, caseId: request.id, umRequestId: request.id },
      { eventType: "UM_REQUEST_CREATED" as const, caseId: request.id, umRequestId: request.id }
    ]);
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
    const stored = structuredClone(row);
    this.rows.set(stored.id, stored);
    this.rowOrder = this.rowOrder.filter((rowId) => rowId !== stored.id);
    this.rowOrder.push(stored.id);
  }

  async listIncentiveRows(): Promise<PersistedIncentiveWorklistRow[]> {
    return this.rowOrder
      .slice()
      .reverse()
      .map((rowId) => structuredClone(this.rows.get(rowId)!));
  }

  async getIncentiveRow(
    umRequestId: string,
    businessPolicyId?: string
  ): Promise<PersistedIncentiveWorklistRow | null> {
    if (businessPolicyId) {
      const row = this.rows.get(buildBusinessEvaluationId({ umRequestId, businessPolicyId }));
      return row ? structuredClone(row) : null;
    }

    return (await this.listIncentiveRows()).find((row) => row.umRequestId === umRequestId) ?? null;
  }
}
