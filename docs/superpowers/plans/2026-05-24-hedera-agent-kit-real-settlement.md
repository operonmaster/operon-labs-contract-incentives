# Hedera Agent Kit Real Settlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace simulated provider-documentation incentive settlement with an actual Hedera Agent Kit v4 HBAR testnet transfer path, while keeping deterministic policy controls and idempotent Firestore audit state.

**Architecture:** Keep PAS submission, policy evaluation, and evidence lookup exactly where they are. Change only the Hedera executor boundary so approved policy results call a narrowly configured Agent Kit HBAR transfer tool with wallet, amount, memo, and tool-surface guardrails. Keep tests network-free by injecting a fake Agent Kit runner into the executor.

**Tech Stack:** Next.js App Router, TypeScript workspaces, Vitest, Firestore persistence, `@hashgraph/hedera-agent-kit@4.0.0`, `@hiero-ledger/sdk`, Hedera testnet, Cloud Run Secret Manager env vars.

---

### Task 1: Real Settlement Executor

**Files:**
- Modify: `src/packages/hedera-executor/package.json`
- Create: `src/packages/hedera-executor/test/index.test.ts`
- Modify: `src/packages/hedera-executor/src/index.ts`

- [ ] **Step 1: Write failing tests**

Add tests that assert:
- `createHederaSettlementConfigFromEnv` defaults to real testnet settlement and reads operator credentials.
- missing real-settlement credentials fail before network execution.
- `executePolicyBoundPayment` calls an injected runner with a single HBAR transfer, approved wallet, amount, and non-PHI memo.
- zero/negative amounts and unsupported currencies are blocked.

- [ ] **Step 2: Run red test**

Run: `npm test -- src/packages/hedera-executor/test/index.test.ts`

Expected: FAIL because config parsing, injected runner, and validation do not exist yet.

- [ ] **Step 3: Implement executor**

Implement:
- `HEDERA_SETTLEMENT_MODE=real|simulated`, default `real`.
- `HEDERA_NETWORK=testnet`, with `mainnet` rejected for this public demo.
- operator account/private key env handling.
- `HEDERA_ALLOWED_RECIPIENT_ACCOUNT_IDS`, `HEDERA_MAX_PAYMENT_HBAR`, and memo sanitization.
- Agent Kit `transfer_hbar_tool` execution through `HederaAgentAPI`.
- simulated mode only when explicitly configured.

- [ ] **Step 4: Run green test**

Run: `npm test -- src/packages/hedera-executor/test/index.test.ts`

Expected: PASS.

### Task 2: Workflow And UI Metadata

**Files:**
- Modify: `src/apps/web/lib/provider-documentation-workflow.ts`
- Modify: `src/apps/web/components/provider-documentation/PlanAuditDetailsModal.tsx`
- Modify: `README.md`

- [ ] **Step 1: Preserve existing workflow tests**

Run: `npm test -- src/apps/web/lib/provider-documentation-workflow.test.ts`

Expected: PASS after executor test mock continues to return a transaction ID.

- [ ] **Step 2: Surface transaction links**

Add a HashScan testnet URL for real Hedera transaction IDs when present. Keep simulated IDs displayable for test mode.

### Task 3: Infra Handoff

**Files:**
- Create: `docs/operon-labs-infra-hedera-settlement-scope.md`
- Modify: `docs/standards/nextjs-standard.md`

- [ ] **Step 1: Document infra contract**

List Secret Manager secrets, Cloud Run env vars, IAM access, and testnet account setup required in `operon-labs-infra`.

- [ ] **Step 2: Document public repo safety**

State that no private keys, PHI, production wallet keys, or real contracts belong in this repo.

### Task 4: Final Verification

**Files:** all changed files.

- [ ] **Step 1: Focused tests**

Run: `npm test -- src/packages/hedera-executor/test/index.test.ts src/apps/web/lib/provider-documentation-workflow.test.ts`

- [ ] **Step 2: Full verification**

Run: `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.
