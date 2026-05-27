# Payment Settlement Identity Implementation Plan

> **Project flat-agent rule:** The top-level controller dispatches bounded agents and remains the only orchestration layer. Assigned agents must implement or review their slice directly; do not spawn nested agents, invoke `subagent-driven-development`, or run `executing-plans` inside worker contexts.

**Goal:** Replace PA-id settlement document identity with deterministic hashed identities keyed by UM request, business policy, and payment policy, then purge dev Firestore records that used the old model.

**Architecture:** `@operon-labs/hedera-executor` owns all settlement identity builders so app stores and workflows never duplicate hash logic. PAS/UM healthcare records stay keyed by readable PA ids, while `incentiveEvaluations`, `paymentPolicyEvidences`, and `paymentIntents` use `ie_...` and `pi_...` ids and store the readable `umRequestId` separately.

**Tech Stack:** TypeScript, Vitest, Next.js app workspace, Firestore, Hedera Agent Kit executor, Node.js purge script.

---

## File Structure

- Modify `src/packages/hedera-executor/src/index.ts`: add `umRequestId`, `businessPolicyId`, and `paymentPolicyId` to settlement request/intent types; export `buildBusinessEvaluationId()` and tuple-based `buildPaymentIntentId()`.
- Modify `src/packages/hedera-executor/test/index.test.ts`: prove deterministic hashed identity, duplicate boundary, memo behavior, and attestation lookup use hashed business evaluation ids.
- Modify `src/apps/web/lib/payment-intent-store.ts` and `src/apps/web/lib/payment-intent-store.test.ts`: validate tuple-derived `pi_...` ids and preserve explicit identity fields in Firestore.
- Modify `src/apps/web/lib/payment-policy-evidence-store.ts` and `src/apps/web/lib/payment-policy-evidence-store.test.ts`: key evidence by `paymentIntentId`, store `incentiveEvaluationId` as `ie_...`, and validate the tuple.
- Modify `src/apps/web/lib/pas-persistence.ts` and `src/apps/web/lib/pas-persistence.test.ts`: write `incentiveEvaluations/{businessEvaluationId}`, preserve hashed `paymentIntentId`, and keep `getIncentiveRow(umRequestId)` as a workflow-friendly lookup by querying/filtering `umRequestId`.
- Modify `src/apps/web/lib/business-evaluation-attestation-store.ts`: pass both hashed evaluation id and readable UM request id through attestation lookup validation.
- Modify `src/apps/web/lib/provider-documentation-workflow.ts` and `src/apps/web/lib/provider-documentation-workflow.test.ts`: derive `businessEvaluationId` and `paymentIntentId` before save/settlement/evidence.
- Modify `src/apps/web/lib/delegate-um-workflow.ts` and `src/apps/web/lib/delegate-um-workflow.test.ts`: use the same identity helpers for delegate rows and payment requests.
- Modify route/component tests only when row keys or modal expectations need to accept `ie_...` / `pi_...` ids while still displaying PA ids.
- Create `scripts/purge-demo-settlement-state.mjs`: explicit deletion utility for `umRequests`, `pasClaims`, `auditEvents`, `incentiveEvaluations`, `paymentPolicyEvidences`, and `paymentIntents`.
- Modify `README.md`, `docs/standards/nextjs-standard.md`, `docs/operon-labs-infra-pas-firestore-scope.md`, `docs/operon-labs-infra-hedera-settlement-scope.md`, and `docs/Operon_Labs_Contract_Incentives_Hedera_Bounty_Scope.md`: document the new identity model and dev purge.

## Coordination Notes

- Do not revert the existing uncommitted Hedera campaign wording or delegate wallet changes.
- Work in the current checkout unless the controller explicitly creates a worktree. The current checkout already includes relevant uncommitted changes.
- Keep healthcare workflow identity readable: `umRequestId`, `caseId`, and Hedera memo stay as the PA id.
- No legacy migration path is needed. Tests that intentionally preserve old UMR/PA canonicalization for healthcare request records can remain, but old PA-keyed settlement-row behavior must be replaced.
- Do not purge `incentivePolicies`, `paymentPolicies`, or reference-data collections.

---

### Task 1: Executor Identity Helpers

**Files:**
- Modify: `src/packages/hedera-executor/src/index.ts`
- Test: `src/packages/hedera-executor/test/index.test.ts`

- [ ] **Step 1: Write failing tests for tuple identity**

Add imports in `src/packages/hedera-executor/test/index.test.ts`:

```ts
import {
  PolicyBoundHbarTransferHook,
  buildBusinessEvaluationId,
  buildHederaTransactionMemo,
  buildPaymentIntent,
  buildPaymentIntentId,
  createHederaSettlementConfigFromEnv,
  createInMemoryPaymentIntentStore,
  executePolicyBoundPayment,
  parseHederaTransactionId,
  HEDERA_TRANSFER_HBAR_TOOL,
  type HederaAgentKitTransferRunner
} from "../src/index";
```

Replace the old canonical-id/fallback tests with:

```ts
it("builds deterministic hashed identities from UM request, business policy, and payment policy", () => {
  const providerBusinessPolicyId = "provider-documentation-completeness-v1";
  const delegateBusinessPolicyId = "delegate-um-summit-pharmacy-sla-bonus-v1";
  const paymentPolicyId = "summit-health-hmo";

  const providerEvaluationId = buildBusinessEvaluationId({
    umRequestId: caseId,
    businessPolicyId: providerBusinessPolicyId
  });
  const delegateEvaluationId = buildBusinessEvaluationId({
    umRequestId: caseId,
    businessPolicyId: delegateBusinessPolicyId
  });
  const providerIntentId = buildPaymentIntentId({
    auditId: "audit-1",
    umRequestId: caseId,
    caseId,
    incentiveEvaluationId: providerEvaluationId,
    businessPolicyId: providerBusinessPolicyId,
    paymentPolicyId,
    amount: 5,
    currency: "HBAR",
    walletId: "0.0.23456"
  });
  const providerIntentIdAgain = buildPaymentIntentId({
    auditId: "audit-2",
    umRequestId: caseId,
    caseId,
    incentiveEvaluationId: providerEvaluationId,
    businessPolicyId: providerBusinessPolicyId,
    paymentPolicyId,
    amount: 5,
    currency: "HBAR",
    walletId: "0.0.23456"
  });
  const delegateIntentId = buildPaymentIntentId({
    auditId: "audit-3",
    umRequestId: caseId,
    caseId,
    incentiveEvaluationId: delegateEvaluationId,
    businessPolicyId: delegateBusinessPolicyId,
    paymentPolicyId,
    amount: 5,
    currency: "HBAR",
    walletId: "0.0.23456"
  });

  expect(providerEvaluationId).toMatch(/^ie_[a-f0-9]{32}$/);
  expect(delegateEvaluationId).toMatch(/^ie_[a-f0-9]{32}$/);
  expect(providerEvaluationId).not.toBe(delegateEvaluationId);
  expect(providerIntentId).toMatch(/^pi_[a-f0-9]{32}$/);
  expect(providerIntentIdAgain).toBe(providerIntentId);
  expect(delegateIntentId).not.toBe(providerIntentId);
});
```

Update the business-evaluation attestation test to expect:

```ts
const businessPolicyId = "provider-documentation-completeness-v1";
const paymentPolicyId = "acme-health-ppo";
const incentiveEvaluationId = buildBusinessEvaluationId({ umRequestId: caseId, businessPolicyId });

expect(result.paymentIntentId).toBe(
  buildPaymentIntentId({
    auditId: "audit-provider-documentation-completeness-v1-1234567890",
    umRequestId: caseId,
    caseId,
    incentiveEvaluationId,
    businessPolicyId,
    paymentPolicyId,
    planId: "acme-health-ppo",
    amount: 5,
    currency: "HBAR",
    walletId: "0.0.23456",
    policyId: businessPolicyId,
    triggerEvent: "PAS_SUBMITTED"
  })
);
expect(businessEvaluationStore.getAttestation).toHaveBeenCalledWith({
  incentiveEvaluationId,
  umRequestId: caseId,
  caseId,
  planId: "acme-health-ppo",
  policyId: businessPolicyId,
  businessPolicyId
});
```

Add duplicate-boundary assertions to the hook test:

```ts
const providerRequest = {
  auditId: "audit-1",
  umRequestId: caseId,
  caseId,
  incentiveEvaluationId: buildBusinessEvaluationId({
    umRequestId: caseId,
    businessPolicyId: "provider-documentation-completeness-v1"
  }),
  businessPolicyId: "provider-documentation-completeness-v1",
  paymentPolicyId: "acme-health-ppo",
  planId: "acme-health-ppo",
  amount: 5,
  currency: "HBAR" as const,
  walletId: "0.0.23456",
  policyId: "provider-documentation-completeness-v1",
  policyVersion: "v1",
  triggerEvent: "PAS_SUBMITTED"
};
const delegateRequest = {
  ...providerRequest,
  auditId: "audit-2",
  incentiveEvaluationId: buildBusinessEvaluationId({
    umRequestId: caseId,
    businessPolicyId: "delegate-um-summit-pharmacy-sla-bonus-v1"
  }),
  businessPolicyId: "delegate-um-summit-pharmacy-sla-bonus-v1",
  policyId: "delegate-um-summit-pharmacy-sla-bonus-v1",
  triggerEvent: "UM_REQUEST_DETERMINED"
};

expect(buildPaymentIntent(providerRequest, execution).id).not.toBe(
  buildPaymentIntent(delegateRequest, execution).id
);
```

- [ ] **Step 2: Run executor tests and verify red**

Run:

```bash
npm test -- src/packages/hedera-executor/test/index.test.ts
```

Expected: FAIL because `buildBusinessEvaluationId`, `umRequestId`, `businessPolicyId`, and `paymentPolicyId` are not implemented consistently yet, and old assertions still expect PA ids where not updated.

- [ ] **Step 3: Implement executor identity helpers**

In `src/packages/hedera-executor/src/index.ts`, update types:

```ts
export interface PaymentApprovalRequest {
  auditId: string;
  umRequestId?: string;
  caseId?: string;
  incentiveEvaluationId?: string;
  planId?: string;
  amount: number;
  currency: Currency;
  walletId: string;
  policyId?: string;
  businessPolicyId?: string;
  paymentPolicyId?: string;
  policyVersion?: string;
  triggerEvent?: string;
  policyControls?: string[];
}
```

```ts
export interface PaymentIntent {
  id: string;
  auditId: string;
  umRequestId: string;
  caseId: string;
  incentiveEvaluationId: string;
  planId?: string;
  policyId?: string;
  businessPolicyId: string;
  paymentPolicyId: string;
  policyVersion?: string;
  triggerEvent?: string;
  token: Currency;
  amount: number;
  sourceAccountId: string;
  recipientAccountId: string;
  transactionMemo: string;
  status: PaymentIntentStatus;
  transactionId: string | null;
  createdAt: string;
  updatedAt: string;
}
```

```ts
export interface BusinessEvaluationAttestationLookup {
  incentiveEvaluationId: string;
  umRequestId: string;
  caseId?: string;
  planId: string;
  policyId?: string;
  businessPolicyId?: string;
}
```

```ts
export interface BusinessEvaluationAttestation {
  incentiveEvaluationId: string;
  umRequestId: string;
  caseId: string;
  planId: string;
  businessPolicyId: string;
  businessPolicyVersion?: string;
  businessPolicyStatus: "active" | "inactive" | "missing";
  amount: number;
  currency: Currency;
  walletId: string;
}
```

Add helpers near `buildPaymentIntentId`:

```ts
export interface BusinessEvaluationIdentityInput {
  umRequestId?: string;
  caseId?: string;
  businessPolicyId?: string;
  policyId?: string;
}

export interface PaymentIntentIdentityInput extends BusinessEvaluationIdentityInput {
  paymentPolicyId?: string;
  planId?: string;
  incentiveEvaluationId?: string;
}

export function buildBusinessEvaluationId(input: BusinessEvaluationIdentityInput): string {
  const identity = getBusinessEvaluationIdentity(input);
  return `ie_${hashIdentity([identity.umRequestId, identity.businessPolicyId])}`;
}

export function buildPaymentIntentId(request: PaymentIntentIdentityInput): string {
  const identity = getPaymentIntentIdentity(request);
  return `pi_${hashIdentity([identity.umRequestId, identity.businessPolicyId, identity.paymentPolicyId])}`;
}

function getBusinessEvaluationIdentity(input: BusinessEvaluationIdentityInput): {
  umRequestId: string;
  businessPolicyId: string;
} {
  const umRequestId = requireCanonicalPaId(input.umRequestId ?? input.caseId, "UM_REQUEST_ID_REQUIRED");
  const businessPolicyId = cleanIdentityPart(input.businessPolicyId ?? input.policyId, "BUSINESS_POLICY_ID_REQUIRED");
  return { umRequestId, businessPolicyId };
}

function getPaymentIntentIdentity(input: PaymentIntentIdentityInput): {
  umRequestId: string;
  businessPolicyId: string;
  paymentPolicyId: string;
} {
  const businessIdentity = getBusinessEvaluationIdentity(input);
  const paymentPolicyId = cleanIdentityPart(input.paymentPolicyId ?? input.planId, "PAYMENT_POLICY_ID_REQUIRED");
  const expectedEvaluationId = buildBusinessEvaluationId(businessIdentity);
  if (input.incentiveEvaluationId && input.incentiveEvaluationId !== expectedEvaluationId) {
    throw new Error("INCENTIVE_EVALUATION_ID_MISMATCH");
  }
  return { ...businessIdentity, paymentPolicyId };
}

function hashIdentity(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

function cleanIdentityPart(value: string | undefined, errorCode: string): string {
  const cleaned = value?.trim();
  if (!cleaned) {
    throw new Error(errorCode);
  }
  if (sanitizeMemoPart(cleaned) !== cleaned) {
    throw new Error(`${errorCode}_INVALID`);
  }
  return cleaned;
}

function requireCanonicalPaId(value: string | undefined, errorCode: string): string {
  const cleaned = value?.trim();
  if (!cleaned) {
    throw new Error(errorCode);
  }
  if (!cleaned.startsWith("PA-")) {
    throw new Error("PAYMENT_ID_NOT_CANONICAL");
  }
  return cleaned;
}
```

Update `buildPaymentIntent`:

```ts
const identity = getPaymentIntentIdentity(request);
const incentiveEvaluationId =
  request.incentiveEvaluationId ?? buildBusinessEvaluationId(identity);

return {
  id: buildPaymentIntentId(identity),
  auditId: request.auditId,
  umRequestId: identity.umRequestId,
  caseId: identity.umRequestId,
  incentiveEvaluationId,
  planId: request.planId,
  policyId: request.policyId,
  businessPolicyId: identity.businessPolicyId,
  paymentPolicyId: identity.paymentPolicyId,
  ...
};
```

Update `buildHederaTransactionMemo` so the memo remains the PA id:

```ts
const memo = request.umRequestId?.trim() ?? request.caseId?.trim();
```

Update simulated settlement and attestation lookup to call `buildPaymentIntentId(request)` and:

```ts
const identity = getPaymentIntentIdentity({
  ...request,
  paymentPolicyId: request.paymentPolicyId ?? options.planPolicy?.planId
});
const incentiveEvaluationId = request.incentiveEvaluationId ?? buildBusinessEvaluationId(identity);
```

When `executePolicyBoundPayment()` receives a `planPolicy`, pass `paymentPolicyId: request.paymentPolicyId ?? planPolicy.planId` into the request used for validation, intent building, memo building, and attestation lookup.

- [ ] **Step 4: Run executor tests and verify green**

Run:

```bash
npm test -- src/packages/hedera-executor/test/index.test.ts
```

Expected: PASS for the executor test file.

---

### Task 2: Firestore Settlement Store Validation

**Files:**
- Modify: `src/apps/web/lib/payment-intent-store.ts`
- Modify: `src/apps/web/lib/payment-policy-evidence-store.ts`
- Test: `src/apps/web/lib/payment-intent-store.test.ts`
- Test: `src/apps/web/lib/payment-policy-evidence-store.test.ts`

- [ ] **Step 1: Write failing payment intent store tests**

In `src/apps/web/lib/payment-intent-store.test.ts`, create intents with the new tuple fields:

```ts
const umRequestId = "PA-260525-1015-ABCD1234";
const businessPolicyId = "provider-documentation-completeness-v1";
const paymentPolicyId = "summit-health-hmo";
const incentiveEvaluationId = buildBusinessEvaluationId({ umRequestId, businessPolicyId });
const intent = buildPaymentIntent(
  {
    auditId: "audit-1",
    umRequestId,
    caseId: umRequestId,
    incentiveEvaluationId,
    businessPolicyId,
    paymentPolicyId,
    planId: paymentPolicyId,
    amount: 5,
    currency: "HBAR",
    walletId: "0.0.9049549",
    policyId: businessPolicyId,
    policyVersion: "v1",
    triggerEvent: "PAS_SUBMITTED"
  },
  {
    sourceAccountId: "0.0.6870566",
    transactionMemo: umRequestId
  }
);
```

Replace the noncanonical-id test expectations:

```ts
await expect(store.reserveIntent({ ...intent, id: "PA-260525-1015-ABCD1234" })).rejects.toThrow(
  "PAYMENT_INTENT_ID_MISMATCH:id"
);
await expect(store.reserveIntent({ ...intent, umRequestId: "UMR-260525-1015-ABCD1234" })).rejects.toThrow(
  "PAYMENT_INTENT_ID_NOT_CANONICAL:umRequestId"
);
await expect(store.reserveIntent({ ...intent, paymentPolicyId: "other-plan" })).rejects.toThrow(
  "PAYMENT_INTENT_ID_MISMATCH:id"
);
```

- [ ] **Step 2: Write failing payment policy evidence store tests**

In `src/apps/web/lib/payment-policy-evidence-store.test.ts`, update the stored evidence test:

```ts
const umRequestId = "PA-260525-1949-ML6LAWFP";
const businessPolicyId = "plcy_9Q3S6V1X8Z2B5D7F0H4K";
const paymentPolicyId = "summit-health-hmo";
const incentiveEvaluationId = buildBusinessEvaluationId({ umRequestId, businessPolicyId });
const paymentIntentId = buildPaymentIntentId({
  umRequestId,
  caseId: umRequestId,
  incentiveEvaluationId,
  businessPolicyId,
  paymentPolicyId
});
const evidence: PaymentPolicyEvidence = {
  incentiveEvaluationId,
  umRequestId,
  caseId: umRequestId,
  planId: paymentPolicyId,
  paymentPolicyId,
  businessPolicyId,
  ...
  paymentIntentId,
  ...
};

await store.saveEvidence(evidence);
await expect(store.getEvidence(paymentIntentId)).resolves.toEqual(evidence);
```

Replace validation expectations:

```ts
await expect(store.saveEvidence({ ...evidence, umRequestId: "UMR-260525-1949-ML6LAWFP" })).rejects.toThrow(
  "PAYMENT_POLICY_EVIDENCE_ID_NOT_CANONICAL:evidence.umRequestId"
);
await expect(store.saveEvidence({ ...evidence, incentiveEvaluationId: "ie_bad" })).rejects.toThrow(
  "PAYMENT_POLICY_EVIDENCE_ID_MISMATCH:evidence.incentiveEvaluationId"
);
await expect(store.saveEvidence({ ...evidence, paymentIntentId: "pi_bad" })).rejects.toThrow(
  "PAYMENT_POLICY_EVIDENCE_ID_MISMATCH:evidence.paymentIntentId"
);
```

- [ ] **Step 3: Run store tests and verify red**

Run:

```bash
npm test -- src/apps/web/lib/payment-intent-store.test.ts src/apps/web/lib/payment-policy-evidence-store.test.ts
```

Expected: FAIL because app stores still require PA document ids and do not know `umRequestId`.

- [ ] **Step 4: Implement payment intent validation**

In `src/apps/web/lib/payment-intent-store.ts`, import helpers:

```ts
import {
  buildBusinessEvaluationId,
  buildPaymentIntentId,
  type PaymentIntent,
  type PaymentIntentStore
} from "@operon-labs/hedera-executor";
```

Replace `validatePaymentIntentIds()`:

```ts
function validatePaymentIntentIds(intent: PaymentIntent): void {
  assertCanonicalPaId(intent.umRequestId, "intent.umRequestId");
  assertMatchingCanonicalId(intent.caseId, intent.umRequestId, "intent.caseId");

  const expectedEvaluationId = buildBusinessEvaluationId({
    umRequestId: intent.umRequestId,
    businessPolicyId: intent.businessPolicyId
  });
  if (intent.incentiveEvaluationId !== expectedEvaluationId) {
    throw new Error("PAYMENT_INTENT_ID_MISMATCH:incentiveEvaluationId");
  }

  const expectedIntentId = buildPaymentIntentId({
    umRequestId: intent.umRequestId,
    caseId: intent.caseId,
    incentiveEvaluationId: intent.incentiveEvaluationId,
    businessPolicyId: intent.businessPolicyId,
    paymentPolicyId: intent.paymentPolicyId
  });
  if (intent.id !== expectedIntentId) {
    throw new Error("PAYMENT_INTENT_ID_MISMATCH:id");
  }
}

function assertCanonicalPaId(value: string, fieldName: string): void {
  if (!value.startsWith("PA-")) {
    throw new Error(`PAYMENT_INTENT_ID_NOT_CANONICAL:${fieldName}`);
  }
}

function assertMatchingCanonicalId(value: string, expected: string, fieldName: string): void {
  if (value !== expected) {
    throw new Error(`PAYMENT_INTENT_ID_MISMATCH:${fieldName}`);
  }
}
```

- [ ] **Step 5: Implement payment policy evidence validation and document key**

In `src/apps/web/lib/payment-policy-evidence-store.ts`, import helpers:

```ts
import { buildBusinessEvaluationId, buildPaymentIntentId } from "@operon-labs/hedera-executor";
```

Extend the type:

```ts
export interface PaymentPolicyEvidence {
  incentiveEvaluationId: string;
  umRequestId: string;
  caseId: string;
  planId: string;
  paymentPolicyId: string;
  businessPolicyId: string;
  ...
  paymentIntentId: string;
  ...
}
```

Save and read by payment intent id:

```ts
.collection(PAYMENT_POLICY_EVIDENCES_COLLECTION)
.doc(evidence.paymentIntentId)
.set(toFirestoreEvidence(evidence));
```

```ts
async getEvidence(paymentIntentId: string): Promise<PaymentPolicyEvidence | null> {
  const snapshot = await (await this.getFirestore())
    .collection(PAYMENT_POLICY_EVIDENCES_COLLECTION)
    .doc(paymentIntentId)
    .get();
  ...
}
```

Replace validation:

```ts
function validatePaymentPolicyEvidenceIds(evidence: PaymentPolicyEvidence): void {
  assertCanonicalPaId(evidence.umRequestId, "evidence.umRequestId");
  assertMatchingCanonicalId(evidence.caseId, evidence.umRequestId, "evidence.caseId");

  const expectedEvaluationId = buildBusinessEvaluationId({
    umRequestId: evidence.umRequestId,
    businessPolicyId: evidence.businessPolicyId
  });
  if (evidence.incentiveEvaluationId !== expectedEvaluationId) {
    throw new Error("PAYMENT_POLICY_EVIDENCE_ID_MISMATCH:evidence.incentiveEvaluationId");
  }

  const expectedPaymentIntentId = buildPaymentIntentId({
    umRequestId: evidence.umRequestId,
    caseId: evidence.caseId,
    incentiveEvaluationId: evidence.incentiveEvaluationId,
    businessPolicyId: evidence.businessPolicyId,
    paymentPolicyId: evidence.paymentPolicyId
  });
  if (evidence.paymentIntentId !== expectedPaymentIntentId) {
    throw new Error("PAYMENT_POLICY_EVIDENCE_ID_MISMATCH:evidence.paymentIntentId");
  }
}
```

- [ ] **Step 6: Run store tests and verify green**

Run:

```bash
npm test -- src/apps/web/lib/payment-intent-store.test.ts src/apps/web/lib/payment-policy-evidence-store.test.ts
```

Expected: PASS for both store test files.

---

### Task 3: PAS Persistence And Business Attestation

**Files:**
- Modify: `src/apps/web/lib/pas-persistence.ts`
- Modify: `src/apps/web/lib/business-evaluation-attestation-store.ts`
- Test: `src/apps/web/lib/pas-persistence.test.ts`

- [ ] **Step 1: Write failing persistence tests**

In `src/apps/web/lib/pas-persistence.test.ts`, replace the old row-id rejection/canonicalization tests with:

```ts
it("persists incentive rows under the hashed business evaluation id and preserves hashed payment intent ids", async () => {
  const firestore = createFakeFirestore();
  const store = createFirestorePasPersistenceStore(
    { projectId: "operon-labs-nonprod", databaseId: "(default)" },
    firestore
  );
  const platform = createInMemoryUmPlatform({ generateCaseId: () => "PA-260526-0900-ROWHASH" });
  const umRequest = platform.submitPriorAuth({ requestType: "outpatient_service", serviceCode: "knee_mri" });
  const businessPolicyId = "provider-documentation-completeness-v1";
  const paymentPolicyId = "summit-health-hmo";
  const businessEvaluationId = buildBusinessEvaluationId({ umRequestId: umRequest.id, businessPolicyId });
  const paymentIntentId = buildPaymentIntentId({
    umRequestId: umRequest.id,
    caseId: umRequest.id,
    incentiveEvaluationId: businessEvaluationId,
    businessPolicyId,
    paymentPolicyId
  });

  await store.saveIncentiveRow(
    buildPersistedIncentiveRow(umRequest, {
      id: businessEvaluationId,
      policyId: businessPolicyId,
      paymentIntentId
    })
  );

  await expect(firestore.collection("incentiveEvaluations").doc(businessEvaluationId).get()).resolves.toMatchObject({
    exists: true
  });
  await expect(store.getIncentiveRow(umRequest.id)).resolves.toMatchObject({
    id: businessEvaluationId,
    umRequestId: umRequest.id,
    caseId: umRequest.id,
    paymentIntentId
  });
});
```

Add a validation test:

```ts
await expect(
  store.saveIncentiveRow(
    buildPersistedIncentiveRow(umRequest, {
      id: "PA-260526-0900-ROWHASH",
      policyId: businessPolicyId,
      paymentIntentId
    })
  )
).rejects.toThrow("PAS_SUBMISSION_ID_MISMATCH:row.id");
```

- [ ] **Step 2: Run persistence tests and verify red**

Run:

```bash
npm test -- src/apps/web/lib/pas-persistence.test.ts
```

Expected: FAIL because rows are still stored at `doc(row.umRequestId)` and `paymentIntentId` is canonicalized back to the PA id.

- [ ] **Step 3: Implement hashed incentive row persistence**

In `src/apps/web/lib/pas-persistence.ts`, import helper functions:

```ts
import { buildBusinessEvaluationId, buildPaymentIntentId } from "@operon-labs/hedera-executor";
```

Update interfaces:

```ts
getIncentiveRow(umRequestId: string, businessPolicyId?: string): Promise<PersistedIncentiveWorklistRow | null>;
```

Implement the document id helper:

```ts
function buildIncentiveRowDocumentId(row: PersistedIncentiveWorklistRow): string {
  return buildBusinessEvaluationId({
    umRequestId: row.umRequestId,
    businessPolicyId: row.policyId
  });
}
```

Update save:

```ts
const documentId = buildIncentiveRowDocumentId(row);
await firestore.collection(INCENTIVE_EVALUATIONS_COLLECTION).doc(documentId).set({
  ...row,
  id: documentId,
  storedAt: new Date().toISOString()
});
```

Update get:

```ts
async getIncentiveRow(
  umRequestId: string,
  businessPolicyId?: string
): Promise<PersistedIncentiveWorklistRow | null> {
  const firestore = await this.getFirestore();
  if (businessPolicyId) {
    const documentId = buildBusinessEvaluationId({ umRequestId, businessPolicyId });
    const snapshot = await firestore.collection(INCENTIVE_EVALUATIONS_COLLECTION).doc(documentId).get();
    return snapshot.exists
      ? canonicalizeStoredIncentiveRow(snapshot.data() as PersistedIncentiveWorklistRow & { storedAt?: string }, documentId)
      : null;
  }

  const rows = await this.listIncentiveRows();
  return rows.find((row) => row.umRequestId === umRequestId) ?? null;
}
```

Replace incentive row validation:

```ts
function validateIncentiveRowIds(row: PersistedIncentiveWorklistRow): void {
  const rowIds = row as PersistedIncentiveWorklistRow & { caseId?: string; id?: string };

  assertCanonicalPaId(row.umRequestId, "row.umRequestId");
  if (rowIds.caseId !== undefined) {
    assertMatchingCanonicalId(rowIds.caseId, row.umRequestId, "row.caseId");
  }

  const expectedBusinessEvaluationId = buildBusinessEvaluationId({
    umRequestId: row.umRequestId,
    businessPolicyId: row.policyId
  });
  if (rowIds.id !== undefined && rowIds.id !== expectedBusinessEvaluationId) {
    throw new Error("PAS_SUBMISSION_ID_MISMATCH:row.id");
  }

  if (row.paymentIntentId !== null) {
    const expectedPaymentIntentId = buildPaymentIntentId({
      umRequestId: row.umRequestId,
      caseId: rowIds.caseId ?? row.umRequestId,
      incentiveEvaluationId: expectedBusinessEvaluationId,
      businessPolicyId: row.policyId,
      paymentPolicyId: row.planId
    });
    if (row.paymentIntentId !== expectedPaymentIntentId) {
      throw new Error("PAS_SUBMISSION_ID_MISMATCH:row.paymentIntentId");
    }
  }
}
```

Update `canonicalizeStoredIncentiveRow()` to preserve hashed ids:

```ts
const canonicalId = getStoredCanonicalPaId(incentiveRow.umRequestId, incentiveRow.caseId);
const policyId = incentiveRow.policyId;
const expectedEvaluationId = policyId
  ? buildBusinessEvaluationId({ umRequestId: canonicalId, businessPolicyId: policyId })
  : fallbackCanonicalId ?? incentiveRow.id ?? canonicalId;

return {
  ...incentiveRow,
  id: expectedEvaluationId,
  umRequestId: canonicalId,
  caseId: canonicalId,
  ...
  paymentIntentId: incentiveRow.paymentIntentId ?? null,
  ...
};
```

- [ ] **Step 4: Update business attestation lookup**

In `src/apps/web/lib/business-evaluation-attestation-store.ts`, update source and row types:

```ts
interface IncentiveEvaluationSource {
  getIncentiveRow(umRequestId: string, businessPolicyId?: string): Promise<RecordedIncentiveEvaluation | null>;
}

interface RecordedIncentiveEvaluation {
  id: string;
  umRequestId: string;
  caseId: string;
  planId?: string;
  policyId: string;
  ...
}
```

Update lookup:

```ts
const businessPolicyId = lookup.businessPolicyId ?? lookup.policyId;
if (!businessPolicyId) {
  return null;
}

const expectedEvaluationId = buildBusinessEvaluationId({
  umRequestId: lookup.umRequestId,
  businessPolicyId
});
if (lookup.incentiveEvaluationId !== expectedEvaluationId) {
  return null;
}

const row = await this.source.getIncentiveRow(lookup.umRequestId, businessPolicyId);
```

Return:

```ts
return {
  incentiveEvaluationId: expectedEvaluationId,
  umRequestId: row.umRequestId,
  caseId: row.caseId,
  planId: lookup.planId,
  businessPolicyId: row.policyId,
  ...
};
```

- [ ] **Step 5: Run persistence tests and verify green**

Run:

```bash
npm test -- src/apps/web/lib/pas-persistence.test.ts
```

Expected: PASS for persistence tests.

---

### Task 4: Workflow Integration

**Files:**
- Modify: `src/apps/web/lib/provider-documentation-workflow.ts`
- Modify: `src/apps/web/lib/delegate-um-workflow.ts`
- Test: `src/apps/web/lib/provider-documentation-workflow.test.ts`
- Test: `src/apps/web/lib/delegate-um-workflow.test.ts`
- Test: `src/apps/web/lib/provider-documentation-routes.test.ts` if route row ids are asserted
- Test: `src/apps/web/lib/delegate-um-routes.test.ts` if route row ids are asserted

- [ ] **Step 1: Write failing workflow tests**

In `src/apps/web/lib/provider-documentation-workflow.test.ts`, update the payment mock to return the computed id:

```ts
executePolicyBoundPayment: vi.fn(async (request: {
  auditId: string;
  umRequestId: string;
  caseId: string;
  incentiveEvaluationId: string;
  businessPolicyId: string;
  paymentPolicyId: string;
  currency: string;
}) => ({
  status: "submitted",
  network: "testnet",
  transactionId: `testnet-${request.auditId}-${request.currency.toLowerCase()}`,
  runtime: "hedera-agent-kit-policy",
  paymentIntentId: buildPaymentIntentId(request)
}))
```

Add an assertion to the approved settlement test:

```ts
const paymentRequest = executePolicyBoundPaymentMock.mock.calls[0]![0]!;
expect(paymentRequest).toMatchObject({
  umRequestId: submitted.id,
  caseId: submitted.id,
  businessPolicyId: rows[0]!.policyId,
  paymentPolicyId: submitted.planId,
  incentiveEvaluationId: buildBusinessEvaluationId({
    umRequestId: submitted.id,
    businessPolicyId: rows[0]!.policyId
  })
});
expect(rows[0]!.id).toBe(paymentRequest.incentiveEvaluationId);
expect(rows[0]!.paymentIntentId).toBe(buildPaymentIntentId(paymentRequest));
```

In `src/apps/web/lib/delegate-um-workflow.test.ts`, mirror the same mock and assert:

```ts
const paymentRequest = executePolicyBoundPaymentMock.mock.calls[0]![0]!;
expect(paymentRequest).toMatchObject({
  umRequestId: umRequest.id,
  caseId: umRequest.id,
  businessPolicyId: "delegate-um-summit-pharmacy-sla-bonus-v1",
  paymentPolicyId: umRequest.planId,
  incentiveEvaluationId: buildBusinessEvaluationId({
    umRequestId: umRequest.id,
    businessPolicyId: "delegate-um-summit-pharmacy-sla-bonus-v1"
  })
});
expect(row.id).toBe(paymentRequest.incentiveEvaluationId);
expect(row.paymentIntentId).toBe(buildPaymentIntentId(paymentRequest));
```

Add an integration test in one workflow test file proving the original bug is gone:

```ts
it("allows provider documentation and delegate UM incentives to settle for the same UM request without payment intent collision", async () => {
  const paymentIntentIds = new Set<string>();
  executePolicyBoundPaymentMock.mockImplementation(async (request) => {
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

  // Submit a delegated prior auth, let provider documentation settle on creation,
  // then complete delegate determination for the same `umRequestId`.
  // Assert two calls, two different `paymentIntentId` values, and both rows paid.
});
```

- [ ] **Step 2: Run workflow tests and verify red**

Run:

```bash
npm test -- src/apps/web/lib/provider-documentation-workflow.test.ts src/apps/web/lib/delegate-um-workflow.test.ts
```

Expected: FAIL because workflows still pass raw PA ids as `incentiveEvaluationId` and do not set `businessPolicyId` / `paymentPolicyId`.

- [ ] **Step 3: Implement provider documentation workflow identity**

In `src/apps/web/lib/provider-documentation-workflow.ts`, import helpers:

```ts
import {
  buildBusinessEvaluationId,
  executePolicyBoundPayment,
  type PaymentIntentStore
} from "@operon-labs/hedera-executor";
```

Before `baseRow`:

```ts
const businessPolicyId = evaluation.result.policyId;
const businessEvaluationId = buildBusinessEvaluationId({
  umRequestId: record.id,
  businessPolicyId
});
```

Set `baseRow.id` to `businessEvaluationId` and keep `umRequestId` / `caseId` as `record.id`:

```ts
id: businessEvaluationId,
umRequestId: record.id,
caseId: record.id,
policyId: businessPolicyId,
```

Pass the tuple to settlement:

```ts
const payment = await executePolicyBoundPayment({
  auditId: audit.id,
  umRequestId: event.umRequestId,
  caseId: event.umRequestId,
  incentiveEvaluationId: businessEvaluationId,
  planId: evidence.planId,
  paymentPolicyId: paymentPolicy.planId,
  amount: evaluation.result.amount,
  currency: evaluation.result.currency,
  walletId: evaluation.result.walletId,
  policyId: businessPolicyId,
  businessPolicyId,
  policyVersion: evaluation.result.policyVersion,
  triggerEvent: event.eventType,
  policyControls
}, ...)
```

Update in-memory attestation source:

```ts
async getIncentiveRow(umRequestId, businessPolicyId) {
  return (
    rows.get(umRequestId) ??
    [...rows.values()].find((row) => row.umRequestId === umRequestId && (!businessPolicyId || row.policyId === businessPolicyId)) ??
    null
  );
}
```

Update `buildPaymentPolicyEvidence()`:

```ts
return {
  incentiveEvaluationId: row.id,
  umRequestId: row.umRequestId,
  caseId: row.caseId,
  planId: paymentPolicy.planId,
  paymentPolicyId: paymentPolicy.planId,
  businessPolicyId: row.policyId,
  ...
  paymentIntentId,
  ...
};
```

- [ ] **Step 4: Implement delegate UM workflow identity**

In `src/apps/web/lib/delegate-um-workflow.ts`, import:

```ts
import {
  buildBusinessEvaluationId,
  executePolicyBoundPayment,
  type PaymentIntentStore
} from "@operon-labs/hedera-executor";
```

Before `baseRow`:

```ts
const businessPolicyId = evaluation.result.policyId;
const businessEvaluationId = buildBusinessEvaluationId({
  umRequestId: request.id,
  businessPolicyId
});
```

Set `baseRow.id` and `policyId`:

```ts
id: businessEvaluationId,
umRequestId: request.id,
policyId: businessPolicyId,
```

Pass the tuple to settlement:

```ts
const payment = await executePolicyBoundPayment(
  {
    auditId: audit.id,
    umRequestId: request.id,
    caseId: request.id,
    incentiveEvaluationId: businessEvaluationId,
    planId: evidence.planId,
    paymentPolicyId: paymentPolicy.planId,
    amount: evaluation.result.amount,
    currency: evaluation.result.currency,
    walletId: evaluation.result.walletId,
    policyId: businessPolicyId,
    businessPolicyId,
    policyVersion: evaluation.result.policyVersion,
    triggerEvent: "UM_REQUEST_DETERMINED",
    policyControls: buildDelegatePolicyControls()
  },
  ...
);
```

Update delegate in-memory attestation source:

```ts
async getIncentiveRow(lookupUmRequestId, lookupBusinessPolicyId) {
  const row = dependencies.rows.get(lookupUmRequestId);
  if (!row || (lookupBusinessPolicyId && row.policyId !== lookupBusinessPolicyId)) {
    return null;
  }
  return {
    ...row,
    caseId: row.umRequestId,
    policyId: row.policyId ?? "",
    audit: row.audit ?? audit
  };
}
```

- [ ] **Step 5: Run workflow tests and verify green**

Run:

```bash
npm test -- src/apps/web/lib/provider-documentation-workflow.test.ts src/apps/web/lib/delegate-um-workflow.test.ts src/apps/web/lib/provider-documentation-routes.test.ts src/apps/web/lib/delegate-um-routes.test.ts
```

Expected: PASS for workflow and affected route tests.

---

### Task 5: Dev Purge Script

**Files:**
- Create: `scripts/purge-demo-settlement-state.mjs`
- Test: command dry run through script output; no unit test required because it performs operational deletion.

- [ ] **Step 1: Create explicit purge script**

Create `scripts/purge-demo-settlement-state.mjs`:

```js
#!/usr/bin/env node
import { Firestore } from "@google-cloud/firestore";

const DEFAULT_PROJECT_ID = "operon-labs-nonprod";
const DEFAULT_DATABASE_ID = "(default)";
const COLLECTIONS = [
  "umRequests",
  "pasClaims",
  "auditEvents",
  "incentiveEvaluations",
  "paymentPolicyEvidences",
  "paymentIntents"
];

const args = new Set(process.argv.slice(2));
const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || DEFAULT_PROJECT_ID;
const databaseId = process.env.FIRESTORE_DATABASE_ID || DEFAULT_DATABASE_ID;
const dryRun = args.has("--dry-run");
const confirmed = args.has("--confirm");

console.log(`Project: ${projectId}`);
console.log(`Database: ${databaseId}`);
console.log(`Collections: ${COLLECTIONS.join(", ")}`);

if (dryRun) {
  console.log("Dry run only. No documents will be deleted.");
}

if (!dryRun && !confirmed) {
  console.error("Refusing to purge without --confirm. Use --dry-run to inspect the target.");
  process.exitCode = 1;
  process.exit();
}

const firestore = new Firestore({ projectId, databaseId });

for (const collectionName of COLLECTIONS) {
  const snapshot = await firestore.collection(collectionName).get();
  console.log(`${collectionName}: ${snapshot.size} document(s)`);

  if (dryRun || snapshot.empty) {
    continue;
  }

  let batch = firestore.batch();
  let pending = 0;
  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    pending += 1;
    if (pending === 450) {
      await batch.commit();
      batch = firestore.batch();
      pending = 0;
    }
  }
  if (pending > 0) {
    await batch.commit();
  }
}

console.log(dryRun ? "Dry run complete." : "Purge complete.");
```

- [ ] **Step 2: Run purge script dry-run**

Run:

```bash
node scripts/purge-demo-settlement-state.mjs --dry-run
```

Expected: exit 0, prints project, database, and exactly the six purge collection names.

- [ ] **Step 3: Run live purge after all tests pass**

Run only after Tasks 1-7 are green:

```bash
node scripts/purge-demo-settlement-state.mjs --confirm
```

Expected: exit 0, deletes only the six listed collections and prints per-collection document counts.

---

### Task 6: Documentation Updates

**Files:**
- Modify: `README.md`
- Modify: `docs/standards/nextjs-standard.md`
- Modify: `docs/operon-labs-infra-pas-firestore-scope.md`
- Modify: `docs/operon-labs-infra-hedera-settlement-scope.md`
- Modify: `docs/Operon_Labs_Contract_Incentives_Hedera_Bounty_Scope.md`

- [ ] **Step 1: Update README identity wording**

Replace the README's old PA-keyed settlement identity wording with:

```md
The Hedera Agent Kit execution policy is intentionally narrower than the healthcare business policy. CRD/DTR/PAS eligibility is evaluated before settlement and recorded in Firestore. Settlement-facing documents use deterministic opaque ids: `incentiveEvaluations/{businessEvaluationId}` where `businessEvaluationId = ie_sha256(umRequestId | businessPolicyId)`, and `paymentIntents/{paymentIntentId}` / `paymentPolicyEvidences/{paymentIntentId}` where `paymentIntentId = pi_sha256(umRequestId | businessPolicyId | paymentPolicyId)`. The readable PA/UM request id remains in `umRequestId`, `caseId`, and the Hedera transaction memo.
```

Also state that Provider Documentation and Delegate UM can both pay for the same UM request because they have different `businessPolicyId` values.

- [ ] **Step 2: Update standards and architecture docs**

In `docs/standards/nextjs-standard.md`, replace the PA-tied canonical id standard with:

```md
Hedera Agent Kit hooks are the settlement-control boundary, not a duplicate CRD/DTR/PAS eligibility engine. Agent Kit execution policy must use flat plan-level `paymentPolicies/{planId}` documents and deterministic tuple ids: `incentiveEvaluations/{businessEvaluationId}` from `umRequestId + businessPolicyId`, and `paymentIntents/{paymentIntentId}` / `paymentPolicyEvidences/{paymentIntentId}` from `umRequestId + businessPolicyId + paymentPolicyId`. Duplicate prevention blocks only the same triplet.
```

In Firestore and Hedera settlement scope docs, update examples to show:

```json
{
  "id": "pi_1f2e3d4c5b6a79800112233445566778",
  "umRequestId": "PA-260527-1132-GNJNP7AE",
  "caseId": "PA-260527-1132-GNJNP7AE",
  "incentiveEvaluationId": "ie_0123456789abcdef0123456789abcdef",
  "businessPolicyId": "delegate-um-summit-pharmacy-sla-bonus-v1",
  "paymentPolicyId": "summit-health-hmo"
}
```

In the Bounty scope doc, note the decision as a judge-friendly control:

```md
The demo prevents duplicate payments at the exact settlement intent boundary, not at the healthcare request boundary. That lets the same UM request produce separate Provider Documentation and Delegate UM incentives while still blocking a repeat of the same `umRequestId + businessPolicyId + paymentPolicyId` payment.
```

- [ ] **Step 3: Run docs search**

Run:

```bash
rg -n "paymentPolicyEvidences/\\{incentiveEvaluationId\\}|paymentIntents/\\{canonicalId\\}|incentiveEvaluations/\\{caseId\\}|paymentIntents/\\{paymentIntentId\\} so Hedera Agent Kit execution can reserve" README.md docs
```

Expected: no output.

---

### Task 7: Full Verification

**Files:**
- All modified files.

- [ ] **Step 1: Run focused test suite**

Run:

```bash
npm test -- src/packages/hedera-executor/test/index.test.ts src/apps/web/lib/payment-intent-store.test.ts src/apps/web/lib/payment-policy-evidence-store.test.ts src/apps/web/lib/pas-persistence.test.ts src/apps/web/lib/business-evaluation-attestation-store.test.ts src/apps/web/lib/provider-documentation-workflow.test.ts src/apps/web/lib/delegate-um-workflow.test.ts src/apps/web/lib/provider-documentation-routes.test.ts src/apps/web/lib/delegate-um-routes.test.ts
```

Expected: PASS for all named test files. If `business-evaluation-attestation-store.test.ts` does not exist, omit it and verify attestation behavior through workflow and executor tests.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 5: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: no output and exit 0.

- [ ] **Step 6: Inspect final diff**

Run:

```bash
git diff --stat
git diff -- src/packages/hedera-executor/src/index.ts src/apps/web/lib/payment-intent-store.ts src/apps/web/lib/payment-policy-evidence-store.ts src/apps/web/lib/pas-persistence.ts src/apps/web/lib/provider-documentation-workflow.ts src/apps/web/lib/delegate-um-workflow.ts
```

Expected: diff shows the approved identity model only, plus already-existing campaign wording and wallet alignment changes.

---

## Self-Review

- Spec coverage: The plan covers shared identity helpers, payment intent validation, payment policy evidence ids, incentive evaluation ids, workflow integration, documentation updates, and a guarded dev purge.
- Placeholder scan: No `TBD`, `TODO`, `later`, `maybe`, `probably`, or generic "add tests" instructions remain.
- Type consistency: The plan uses `umRequestId`, `businessPolicyId`, `paymentPolicyId`, `businessEvaluationId`, `incentiveEvaluationId`, and `paymentIntentId` consistently across executor, stores, and workflows.
