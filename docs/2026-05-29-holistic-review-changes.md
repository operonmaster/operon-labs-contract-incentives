# Holistic Code Review — Changes Summary

**Date:** 2026-05-29
**Branch:** `feat/init-next-structure`
**Scope:** Repo-wide review (docs vs. implementation) with extra focus on UI/React/shared components, followed by full remediation of every finding.

---

## Verification status

All four mandated checks (per [`docs/standards/nextjs-standard.md`](standards/nextjs-standard.md)) pass after the changes:

| Check | Before | After |
|-------|--------|-------|
| `npm run lint` | clean | ✅ clean |
| `npm run typecheck` | clean | ✅ clean |
| `npm test` | **1 failing (5s hang) / 312** | ✅ **333 passed / 43 files** |
| `npm run build` | ✅ | ✅ Compiled successfully |

**Files touched:** 50 (41 modified, 9 new). No commit made yet.

---

## 1. Critical — test suite was red

### C1 — Tests were hitting **real GCP Firestore** and hanging
- **Root cause:** [`vitest.setup.ts`](../vitest.setup.ts) forced every store backend to `memory` **except** `PAYMENT_INTENT_STORE_BACKEND`. `createPaymentIntentStoreFromEnv()` defaults to `firestore`, so the Specialty Rx blocked-settlement test built a real Firestore client and hung on a network call (`Firestore.getAll`).
- **Fix:** Set **every** store backend to `memory` in `vitest.setup.ts` (added `PAYMENT_INTENT_STORE_BACKEND` and `SPECIALTY_RX_STORE_BACKEND`) plus a guard that throws loudly if any backend still resolves to `firestore` in tests.
- Updated `provider-documentation-workflow.test.ts` (the workflow now forwards `undefined` for the intent store in memory mode; production firestore default is covered independently in `payment-intent-store.test.ts`).
- **Result:** suite runs in ~4s with no network access.

---

## 2. Backend — correctness & security

### B1 — Specialty Rx eligibility evasion (input validation)
- The four step routes did `await request.json() as XInput` (no validation) and the workflow spread `...input` into persisted docs — a request body could flip `shipment.coldChainRequired` (an eligibility field **not** in `ScheduleShipmentInput`) to skip cold-chain evidence.
- **New** [`src/apps/web/lib/specialty-rx-input.ts`](../src/apps/web/lib/specialty-rx-input.ts): `parseCompleteIntakeInput` / `parseClearToFillInput` / `parseScheduleShipmentInput` / `parseConfirmFulfillmentInput`. Reject non-objects, non-boolean fields, bad `exceptionReasonCode`; drop unknown keys.
- All four routes (`intake`, `clear-to-fill`, `fulfillment`, `shipment`) now validate → return `400` before touching the workflow.
- `specialty-rx-workflow.ts`: replaced the three spreads with field-by-field builders (`buildClearToFillState`, `buildShipmentState`, `buildFulfillmentState`) — `coldChainRequired` is preserved from the server-owned case, never the request body.
- Tests: parser unit tests, route-level 400 tests, and a workflow injection test.

### B2/B3 — Settlement state desync & lost failure reason
- `hedera-executor`: replaced the silent `markIntentSubmitted().catch(() => undefined)` with `reconcilePaymentIntentSubmission` (retry once, then **log loudly**) so a post-transfer bookkeeping failure is observable without failing a completed on-chain transfer.
- Added `failureReasonCode` to `PaymentIntent`; both the in-memory store and the Firestore [`payment-intent-store.ts`](../src/apps/web/lib/payment-intent-store.ts) now persist the reason passed to `markIntentFailed`.

### Backend hardening
- `payment-intent-store.ts`: `reserveIntent` now **requires atomic `create`** (throws `PAYMENT_INTENT_RESERVE_REQUIRES_ATOMIC_CREATE`) instead of falling back to a racy check-then-set.
- `hedera-executor`: `requireCanonicalPaId` now rejects `|`/unsafe characters (prevents settlement-tuple hash collisions).
- `provider-documentation-workflow.ts`: `processPlatformEvents` now logs swallowed async-incentive errors instead of discarding them silently.
- **Note:** the policy `effectivePeriod` check was reported as missing but is in fact already enforced at the store-selection layer (`isPolicyEffective`, with `submittedAt` passed by all workflows) — no change needed; the engine stays pure/deterministic.

---

## 3. Shared UI primitives (new)

| File | Purpose |
|------|---------|
| [`labs-ui/LabsModal.tsx`](../src/apps/web/components/labs-ui/LabsModal.tsx) | Accessible dialog shell: `role="dialog"` + `aria-modal` + `aria-labelledby`, Escape-to-close, focus-on-open, **focus trap**, focus restoration, backdrop click. |
| [`labs-ui/index.tsx` → `LabsUseCaseNav`](../src/apps/web/components/labs-ui/index.tsx) | Config-driven three-up "use case" nav. |
| [`labs-ui/index.tsx` → `LabsButton`](../src/apps/web/components/labs-ui/index.tsx) | Button primitive: `variant="primary"\|"secondary"\|"row"`; forwards all native props. |
| [`incentive-audit-evidence.tsx`](../src/apps/web/components/incentive-audit-evidence.tsx) | Shared `EvidenceRows`, `formatTransaction` (HashScan link), `controlStatusBadgeVariant`. |
| [`use-incentive-worklist.ts`](../src/apps/web/components/use-incentive-worklist.ts) | Worklist data-fetch hook: loading/error state, stale-response guard, selection reducer, `AbortController` cancellation. |
| [`use-interval-tick.ts`](../src/apps/web/components/use-interval-tick.ts) | Forces periodic re-render so time-derived SLA badges stay live. |

---

## 4. UI consolidation & dedup

### U3/F4 — Accessible modal everywhere
Migrated **all 7 hand-rolled modals** to `LabsModal`. The 5 that previously had **no** Escape/focus management now do; removed the bespoke focus/Escape effects from the 2 that had them.
- `PlanAuditDetailsModal`, `DelegatePlanAuditDetailsModal`, `SpecialtyRxPlanDetailsModal`, `DelegateReviewModal`, `SpecialtyRxWorkflowModal`, `PolicyConsole` (PolicyDetailsModal), `ProviderDocumentationWizard` (assessment modal).

### U2 — One nav instead of three
`UseCaseNavigation`, `DelegateUseCaseNavigation`, `SpecialtyRxUseCaseNavigation` reduced to thin config wrappers over `LabsUseCaseNav` (the previously-divergent context-param logic is now explicit).

### F6 — One evidence table instead of three
The triplicated evidence/transaction helpers now live in `incentive-audit-evidence.tsx`; all three detail modals import them.

### F5/F9 — One worklist hook instead of five
All five consoles (`PlanIncentivesConsole`, `DelegatePlanConsole`, `SpecialtyRxPlanConsole`, `DelegateVendorConsole`, `SpecialtyRxConsole`) now use `useIncentiveWorklist`, dropping ~60 lines of duplicated fetch/state logic each and gaining in-flight request cancellation.

### U5 — One button primitive instead of 32 inline class strings
Migrated **all 32 styled button call sites** across 11 files to `LabsButton`. Genuinely-custom buttons (`policy-card-action`, `request-type-card`) intentionally stay plain.
- **Not promoted:** `LabsCard` (single call site — a styled `<Link>`) and `LabsTable` (feature-specific columns). Wrappers there would add indirection without dedup; documented as intentionally skipped.

---

## 5. Bug fixes & polish

| ID | Fix |
|----|-----|
| **F1** | `paymentPolicyBadgeVariant` now switches on the raw status enum (was brittle string-matching the label). |
| **F2** | `formatRequestType` gained a `default` branch (all three copies) — no more blank cells on unexpected enums. |
| **F3** | `formatCurrency` guards a missing `incentiveValue` (all three copies) — no crash on unpaid rows. |
| **F7** | `SpecialtyRxConsole.handleUpdated` no longer calls `setState` inside a `setRows` updater (StrictMode-safe). |
| **F8** | SLA countdown badges tick live via `useIntervalTick(30000)` in the workqueue consoles. |
| **U4** | `LabsSelect` gained `ariaLabel`/`ariaLabelledby` props, wired at all 4 call sites (the trigger was an unlabeled combobox). |
| **U1** | Defined the undefined `--op-orange-2` token (active deck-rail step was silently broken). |
| **U6** | Geist/Geist Mono moved to `next/font` (self-hosted); dropped the render-blocking remote `@import`. |
| **U7** | Recurring focus-ring literal lifted into `--op-focus-ring`. (Broader two-pass CSS restructure left as-is — needs visual QA.) |
| **U8** | `LabsProductFrame` no longer hides its meaningful title from screen readers (only the decorative dots are `aria-hidden`). |

---

## 6. New / notable files

**New (9):**
```
src/apps/web/lib/specialty-rx-input.ts          + .test.ts
src/apps/web/components/labs-ui/LabsModal.tsx    + .test.tsx
src/apps/web/components/labs-ui/LabsButton.test.tsx
src/apps/web/components/labs-ui/LabsUseCaseNav.test.tsx
src/apps/web/components/incentive-audit-evidence.tsx
src/apps/web/components/use-incentive-worklist.ts
src/apps/web/components/use-interval-tick.ts
```

**Tests added** for: Specialty Rx input parsers, route-level 400s, the cold-chain injection guard, `markIntentFailed` reason persistence, atomic-create enforcement, the post-transfer retry/log path, the `|`-injection rejection, async-incentive error logging, `LabsModal`, `LabsButton` (variant→class mapping), `LabsUseCaseNav`, the worklist selection reducer, and formatter guards.

---

## 7. Intentionally deferred / not done

- **U7 (full CSS restructure):** the two-pass light/dark stylesheet with dead overrides was left intact — removing it safely requires visual-regression testing this codebase doesn't have. Only the safe focus-ring token extraction was applied.
- **`LabsCard` / `LabsTable`:** not promoted (single call site / feature-specific columns).
- **Auth/rate-limiting on settlement POSTs:** out of scope for a public demo; flagged in the review as an acknowledged, intentional openness.

---

## 8. Suggested next steps

1. Commit on `feat/init-next-structure` and open a PR.
2. (Optional) Add visual-regression coverage, then revisit the U7 CSS restructure.
3. (Optional) Decide whether the public demo wants lightweight rate-limiting on settlement-triggering routes.
