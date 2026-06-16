# Firestore UM Reference Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move patient, CRD, and DTR reference reads behind a seedable store so runtime APIs use Firestore-backed reference data by default.

**Architecture:** Add a `um-reference-data` store in the Next.js web app with Firestore and memory implementations. Firestore is the default runtime backend; tests use explicit memory. Routes read patients, CRD service options, coverage requirements, and DTR questionnaires from this store, which auto-seeds the demo catalog into Firestore when empty.

**Tech Stack:** Next.js route handlers, `@google-cloud/firestore`, Vitest, existing `@operon-labs/um-platform` seed catalog.

---

### Task 1: Store Contract And Tests

**Files:**
- Create: `src/apps/web/lib/um-reference-data.test.ts`
- Create: `src/apps/web/lib/um-reference-data.ts`
- Modify: `vitest.setup.ts`

- [ ] Write failing tests for default Firestore selection, explicit memory selection, patient listing, coverage requirement lookup, DTR questionnaire lookup, and Firestore seeding boundaries.
- [ ] Implement `UmReferenceDataStore` with memory and Firestore implementations.
- [ ] Use `UM_REFERENCE_STORE_BACKEND=memory` in Vitest setup.

### Task 2: Route Integration

**Files:**
- Create: `src/apps/web/app/api/um/patients/route.ts`
- Modify: `src/apps/web/app/api/um/crd/service-options/route.ts`
- Modify: `src/apps/web/app/api/um/crd/coverage-requirements/route.ts`
- Modify: `src/apps/web/app/api/um/dtr/questionnaires/[questionnaireId]/route.ts`
- Modify: `src/apps/web/lib/provider-documentation-routes.test.ts`

- [ ] Add tests proving routes return seeded Firestore-style data.
- [ ] Route all patient, CRD, and DTR reads through `umReferenceDataStore`.

### Task 3: Provider Portal Data Flow

**Files:**
- Modify: `src/apps/web/components/provider-documentation/ProviderDocumentationWizard.tsx`

- [ ] Fetch patients/plans from `/api/um/patients`.
- [ ] Fetch CRD service options after plan selection.
- [ ] Include `planId` in coverage requirements requests.
- [ ] Preserve the current one-patient demo behavior.

### Task 4: Verification

**Files:**
- Modify docs if needed.

- [ ] Run focused tests.
- [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- [ ] Restart local server and verify Firestore reference collections exist after route access.
