# Hedera Policy Auto Settlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the provider-documentation demo so a PAS submission triggers policy-bound Hedera testnet settlement automatically, while the health plan view acts as an audit console.

**Architecture:** Keep the provider portal separate from incentives. The UM submission endpoint emits `PAS_SUBMITTED`; the workflow evaluates policy evidence by `caseId`; approved requests execute through a Hedera Agent Kit-shaped policy runtime with pre-authorized guardrails; blocked requests record zero value and no transaction. The plan UI lists submitted PAs, selected evidence, policy outcome, and transaction/audit details.

**Tech Stack:** Next.js App Router, React client components, TypeScript workspaces, Vitest, Hedera Agent Kit JS dependency, existing in-memory UM platform, policy engine, audit log, and Hedera executor packages.

---

### Task 1: Policy Settlement Workflow

**Files:**
- Modify: `src/apps/web/lib/provider-documentation-workflow.test.ts`
- Modify: `src/apps/web/lib/provider-documentation-workflow.ts`
- Modify: `src/packages/hedera-executor/src/index.ts`

- [ ] **Step 1: Write failing workflow tests**

Change the knee MRI test to expect `incentiveStatus: "paid"` and a transaction after `await workflow.submitPriorAuth(...)`. Add a blocked-row assertion for full-body and skipped-assessment paths with `paymentStatus: "blocked_by_policy"`.

- [ ] **Step 2: Verify red**

Run: `npm test -- src/apps/web/lib/provider-documentation-workflow.test.ts`

Expected: FAIL because the current workflow returns `eligible_pending_approval` and requires manual `approvePayment`.

- [ ] **Step 3: Implement auto settlement**

Make `submitPriorAuth` async. After UM submission, process the matching `PAS_SUBMITTED` event. If policy approves, call the executor immediately and store the transaction ID. If policy blocks, store a zero-value row. Preserve provider submission when evidence processing fails.

- [ ] **Step 4: Verify green**

Run: `npm test -- src/apps/web/lib/provider-documentation-workflow.test.ts`

Expected: PASS.

### Task 2: API Routes

**Files:**
- Modify: `src/apps/web/lib/provider-documentation-routes.test.ts`
- Modify: `src/apps/web/app/api/um/prior-auths/route.ts`
- Delete or neutralize: `src/apps/web/app/api/provider-documentation/incentives/[caseId]/approve/route.ts`
- Modify: `src/apps/web/app/api/provider-documentation/incentives/route.ts`

- [ ] **Step 1: Write failing route tests**

Replace approval-route expectations with a test that prior-auth submission returns normally and the plan worklist later shows `paid` plus a transaction ID.

- [ ] **Step 2: Verify red**

Run: `npm test -- src/apps/web/lib/provider-documentation-routes.test.ts`

Expected: FAIL while route code is still synchronous/manual.

- [ ] **Step 3: Update routes**

Await `providerDocumentationWorkflow.submitPriorAuth(body)`. Make incentive list route await rows. Remove the approval dependency from the product path.

- [ ] **Step 4: Verify green**

Run: `npm test -- src/apps/web/lib/provider-documentation-routes.test.ts`

Expected: PASS.

### Task 3: Cross Navigation And Audit Console

**Files:**
- Create: `src/apps/web/components/provider-documentation/UseCaseNavigation.tsx`
- Modify: `src/apps/web/components/provider-documentation/ProviderDocumentationWizard.tsx`
- Modify: `src/apps/web/components/provider-documentation/PlanIncentivesConsole.tsx`
- Modify: `src/apps/web/app/styles.css`

- [ ] **Step 1: Add top navigation**

Add `Provider View` and `Health Plan View` links near the top of both pages. Preserve context with `?caseId=<id>` after submission or selected row.

- [ ] **Step 2: Make plan console audit-first**

Remove manual approval actions. Show submitted PA preview, policy evaluation, pre-authorized guardrails, payment status, Hedera network, and transaction ID.

- [ ] **Step 3: Verify visual behavior**

Open `/provider-documentation`, submit a knee MRI, switch to Health Plan View, and confirm the selected PA audit details appear.

### Task 4: Requirements Documentation

**Files:**
- Modify: `docs/Operon_Labs_Contract_Incentives_Hedera_Bounty_Scope.md`
- Modify: `src/apps/web/lib/policy-store.ts`
- Modify: `README.md`

- [ ] **Step 1: Update requirement language**

Replace provider-documentation manual approval language with pre-authorized policy-bound auto-settlement. Keep explicit safety controls: allowed recipient, per-request cap, monthly cap, no PHI, synthetic data, and testnet.

- [ ] **Step 2: Update acceptance criteria**

Require the demo to show automatic transaction recording for approved PAS events and policy block/no transaction for ineligible events.

### Task 5: Final Verification

**Files:** all changed files.

- [ ] **Step 1: Run focused tests**

Run: `npm test -- src/apps/web/lib/provider-documentation-workflow.test.ts src/apps/web/lib/provider-documentation-routes.test.ts`

- [ ] **Step 2: Run full verification**

Run: `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.

- [ ] **Step 3: Browser verify**

Use the browser to verify provider-to-plan navigation and paid/blocked audit rows on `http://localhost:3001/provider-documentation`.
