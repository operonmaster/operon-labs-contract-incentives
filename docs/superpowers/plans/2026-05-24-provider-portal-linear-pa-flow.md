# Provider Portal Linear PA Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework `/provider-documentation` into a realistic linear provider prior authorization portal flow with patient, plan, service, requirements check, assessment modal, review, and submit.

**Architecture:** Keep the existing in-memory UM platform and plan-side incentive console, but relax the UM knee MRI submission rule so skipped assessment can submit and produce incomplete evidence. Remodel `ProviderDocumentationWizard` as a single client-side state machine that hides CRD/DTR/PAS terminology while still calling the existing UM submission API.

**Tech Stack:** Next.js App Router, React client component state, TypeScript workspace packages, Vitest, existing CSS.

---

## File Structure

- Modify `src/packages/um-platform/src/index.ts`: allow covered knee MRI submissions with missing DTR, and derive incomplete evidence.
- Modify `src/packages/um-platform/test/provider-documentation.test.ts`: update UM behavior tests for complete and skipped assessment paths.
- Modify `src/apps/web/lib/provider-documentation-workflow.test.ts`: add skipped-assessment incentive workflow coverage.
- Modify `src/apps/web/lib/provider-documentation-routes.test.ts`: add route coverage for knee MRI submission without DTR and not-eligible payment rejection.
- Replace `src/apps/web/components/provider-documentation/ProviderDocumentationWizard.tsx`: linear wizard UI and assessment modal.
- Modify `src/apps/web/app/styles.css`: wizard, stepper, modal, review, warning, and form controls.
- Modify `README.md`: update provider documentation demo steps.

## Task 1: UM Platform Allows Skipped Assessment

**Files:**
- Modify: `src/packages/um-platform/test/provider-documentation.test.ts`
- Modify: `src/packages/um-platform/src/index.ts`

- [ ] **Step 1: Write failing UM test**

Add a test that submits knee MRI without `dtr` and expects `submitted_pending` plus incomplete evidence:

```ts
it("allows knee MRI submission when assessment is skipped and exposes incomplete evidence", () => {
  const platform = createInMemoryUmPlatform();

  const submitted = platform.submitPriorAuth({ serviceCode: "knee_mri" });

  expect(submitted).toMatchObject({
    caseId: "synthetic-pa-20931",
    serviceCode: "knee_mri",
    paResult: "submitted_pending",
    denialReason: null,
    dtr: null
  });
  expect(platform.getEvidence("synthetic-pa-20931")).toMatchObject({
    serviceCode: "knee_mri",
    crdCoveredBenefit: true,
    dtrTemplateCompleted: false,
    attachmentChecklistComplete: false,
    fhirFieldsPresent: false,
    pasSubmitted: true,
    denialReason: null
  });
});
```

- [ ] **Step 2: Update old UM expectation**

Replace the existing `requires complete DTR documentation for knee MRI submission` test with an evidence-focused test for incomplete answers:

```ts
it("stores incomplete knee MRI assessment as incomplete evidence instead of blocking submission", () => {
  const platform = createInMemoryUmPlatform();

  platform.submitPriorAuth({
    serviceCode: "knee_mri",
    dtr: {
      symptomDurationConfirmed: true,
      conservativeTherapyConfirmed: false,
      examFindingsConfirmed: true,
      clinicalNoteAttached: true
    }
  });

  expect(platform.getEvidence("synthetic-pa-20931")).toMatchObject({
    dtrTemplateCompleted: false,
    attachmentChecklistComplete: false,
    fhirFieldsPresent: false
  });
});
```

- [ ] **Step 3: Verify red**

Run: `npm test -- src/packages/um-platform/test/provider-documentation.test.ts`

Expected: FAIL because current `submitPriorAuth()` throws `DTR_DOCUMENTATION_INCOMPLETE` for incomplete/missing knee MRI DTR.

- [ ] **Step 4: Implement UM change**

In `src/packages/um-platform/src/index.ts`, remove the knee MRI blocking check:

```ts
if (input.serviceCode === "knee_mri" && !isCompleteDtr(input.dtr)) {
  throw new Error("DTR_DOCUMENTATION_INCOMPLETE");
}
```

Keep `isCompleteDtr()` for evidence derivation.

- [ ] **Step 5: Verify green**

Run: `npm test -- src/packages/um-platform/test/provider-documentation.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/packages/um-platform/src/index.ts src/packages/um-platform/test/provider-documentation.test.ts
git commit -m "feat: allow skipped provider assessment submissions"
```

## Task 2: Workflow And Route Coverage For Skipped Assessment

**Files:**
- Modify: `src/apps/web/lib/provider-documentation-workflow.test.ts`
- Modify: `src/apps/web/lib/provider-documentation-routes.test.ts`

- [ ] **Step 1: Write failing workflow test**

Add:

```ts
it("submits knee MRI with skipped assessment as zero-value not eligible", () => {
  const workflow = createProviderDocumentationWorkflow();

  const submitted = workflow.submitPriorAuth({ serviceCode: "knee_mri" });
  const rows = workflow.listIncentiveRows();

  expect(submitted).toMatchObject({
    caseId: "synthetic-pa-20931",
    paResult: "submitted_pending"
  });
  expect(rows[0]).toMatchObject({
    caseId: "synthetic-pa-20931",
    serviceLabel: "Knee MRI after injury",
    paResult: "submitted_pending",
    incentiveStatus: "not_eligible",
    incentiveValue: 0,
    reason: "Missing required documentation"
  });
  expect(rows[0]!.reasonCodes).toEqual(
    expect.arrayContaining(["DTR_TEMPLATE_INCOMPLETE", "ATTACHMENT_CHECKLIST_INCOMPLETE", "FHIR_FIELDS_MISSING"])
  );
});
```

- [ ] **Step 2: Write failing route test**

Add:

```ts
it("accepts knee MRI prior auth submission when assessment is skipped", async () => {
  const submittedResponse = await submitPriorAuth(
    new Request("http://localhost/api/um/prior-auths", {
      method: "POST",
      body: JSON.stringify({ serviceCode: "knee_mri" })
    })
  );
  const submitted = (await submittedResponse.json()) as { caseId: string; paResult: string; dtr: unknown };

  expect(submittedResponse.status).toBe(200);
  expect(submitted).toMatchObject({
    paResult: "submitted_pending",
    dtr: null
  });
});
```

- [ ] **Step 3: Verify red**

Run: `npm test -- src/apps/web/lib/provider-documentation-workflow.test.ts src/apps/web/lib/provider-documentation-routes.test.ts`

Expected: FAIL before Task 1 implementation, PASS after Task 1. If already green after Task 1, continue.

- [ ] **Step 4: Verify approval rejection**

Ensure existing payment rejection test covers `knee_mri` skipped assessment or add:

```ts
workflow.submitPriorAuth({ serviceCode: "knee_mri" });
await expect(workflow.approvePayment("synthetic-pa-20931")).rejects.toThrow("PAYMENT_NOT_ELIGIBLE");
```

- [ ] **Step 5: Run tests**

Run: `npm test -- src/apps/web/lib/provider-documentation-workflow.test.ts src/apps/web/lib/provider-documentation-routes.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/apps/web/lib/provider-documentation-workflow.test.ts src/apps/web/lib/provider-documentation-routes.test.ts
git commit -m "test: cover skipped assessment incentive path"
```

## Task 3: Linear Provider Wizard UI

**Files:**
- Modify: `src/apps/web/components/provider-documentation/ProviderDocumentationWizard.tsx`
- Modify: `src/apps/web/app/styles.css`

- [ ] **Step 1: Replace component state model**

Use:

```ts
type PatientId = "patient-maya-chen";
type PlanId = "acme-health-ppo";
type WizardStep = "patient" | "plan" | "service" | "requirements" | "assessment" | "review";
type AssessmentStatus = "not_required" | "not_started" | "complete" | "skipped";
```

- [ ] **Step 2: Implement gated dropdown flow**

Render patient, plan, and service native `<select>` controls. Plan is disabled until patient is selected. Service is disabled until plan is selected. Requirements button is disabled until service is selected.

- [ ] **Step 3: Implement requirements result**

For knee MRI, show coverage confirmed, PA required, additional assessment required, and `Open assessment` / `Continue to review`. For full-body wellness MRI, show not-covered warning, acknowledgement checkbox, and `Continue to review`.

- [ ] **Step 4: Implement assessment modal**

The modal has four checked-by-default assessment items, `Save assessment`, and `Skip assessment`. Save sets `dtrComplete` true and `assessmentStatus` to `complete`. Skip sets `assessmentStatus` to `skipped`.

- [ ] **Step 5: Implement review submit body**

Submit body:

```ts
const body =
  serviceCode === "knee_mri"
    ? {
        serviceCode,
        dtr: assessmentStatus === "complete" ? completeDtr : undefined
      }
    : { serviceCode, acknowledgedNotCovered };
```

- [ ] **Step 6: Style wizard and modal**

Add CSS for `.wizard-shell`, `.stepper`, `.wizard-form`, `.form-row`, `.select-control`, `.requirement-result`, `.modal-backdrop`, `.modal`, `.review-list`, and `.warning-copy`.

- [ ] **Step 7: Verify manually by build**

Run: `npm run lint && npm run typecheck && npm run build`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/apps/web/components/provider-documentation/ProviderDocumentationWizard.tsx src/apps/web/app/styles.css
git commit -m "feat: redesign provider PA wizard"
```

## Task 4: Docs And End-To-End Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update demo steps**

Change provider documentation demo sequence to include:

```md
1. Select `Maya Chen`, `Acme Health PPO`, and `Knee MRI after injury`.
2. Check requirements, complete the assessment, and submit.
3. Review the eligible `3 USDC` row in the plan console.
4. Submit a second knee MRI request and skip the assessment.
5. Review the `0 USDC` missing-documentation row.
6. Submit `Full-body wellness MRI screening` after acknowledging the not-covered warning.
7. Review the `0 USDC` not-covered row.
```

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run lint
npm test
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

Expected: first four pass. Audit may still fail on the known Next/PostCSS advisory.

- [ ] **Step 3: Browser/API verification**

Run production server and verify:

```bash
npm --workspace @operon-labs/web exec next start -- --hostname 127.0.0.1
```

Then verify via browser:

- full covered complete-assessment UI path
- covered skipped-assessment UI path
- full-body not-covered UI path
- plan console shows three corresponding rows

- [ ] **Step 4: Commit docs**

```bash
git add README.md
git commit -m "docs: update provider portal demo flow"
```
