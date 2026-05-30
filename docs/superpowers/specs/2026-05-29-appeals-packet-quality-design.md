# Appeals Packet Quality Design

## Goal

Add the final demo use case: Appeals Packet Quality. The demo should feel like Specialty Rx Fulfillment SLA: a user works through a realistic inner workflow, the workflow produces policy-safe evidence, and the plan-side audit view shows whether the contract incentive was earned and settled.

The incentive rewards appeal packet readiness only. It must not reward appeal outcome, denial reversal, medical spend reduction, utilization reduction, or any other clinical/financial result.

## Product Shape

`/appeals` becomes a provider appeals console instead of a static demo page. It lists all prior authorization requests from `GET /api/um/prior-auths` and makes eligibility visible:

- pending or in-review PA: disabled action, "Awaiting determination"
- approved PA: disabled action, "Not appeal-eligible"
- denied PA without appeal: enabled `Start appeal`
- denied PA with existing appeal: enabled `Open appeal`

The demo supports exactly one appeal per PA. That keeps the settlement identity compatible with the current Hedera executor, which keys business evaluations and payment intents by `umRequestId + businessPolicyId`, while still giving Appeals its own workflow object and state.

## Appeal Entity

Create a separate `AppealCase` entity rather than extending `UMRequest`.

Reasoning:

- `UMRequest` represents the original prior authorization lifecycle.
- Appeals has a distinct clock, operator workflow, missing-info loop, packet evidence, and reviewer handoff.
- Reusing `UMRequest` would blur original PA determination state with exception-path appeal packet state.
- Specialty Rx already proves the linked-entity pattern: `SpecialtyFulfillmentCase` owns downstream operational state and links back to `umRequestId`.

Proposed shape:

```ts
type AppealCaseState =
  | "created"
  | "intake_validated"
  | "decision_retrieved"
  | "missing_info_resolved"
  | "packet_assembled"
  | "evidence_indexed"
  | "routed_for_review"
  | "packet_ready";

interface AppealCase {
  id: string; // APL-* derived from linked PA
  umRequestId: string; // PA-*
  source: "provider_started_from_denied_pa";
  planId: string;
  providerId: string;
  submitterId: "lakeside-provider-admin";
  requestType: UMRequest["requestType"];
  serviceCode: UMRequest["serviceCode"];
  serviceLabel: string;
  originalOutcomeStatus: "denied";
  originalDenialReasonCode: string | null;
  state: AppealCaseState;
  appealReceivedAt: string;
  acknowledgedAt: string | null;
  packetReadyAt: string | null;
  packetReadinessSlaHours: 24 | 4;
  acknowledgementSlaBusinessHours: 2;
  expedited: boolean;
  intake: {
    appealRequestPresent: boolean;
    appellantAuthorized: boolean;
    planMemberMatched: boolean;
    requestedServiceMatched: boolean;
  };
  originalDecision: {
    denialReasonRetrieved: boolean;
    priorDecisionSummaryIncluded: boolean;
    coveragePolicyLocated: boolean;
  };
  missingInfo: {
    missingInfoRequired: boolean;
    missingInfoRequested: boolean;
    missingInfoResolved: boolean;
  };
  packet: {
    requiredDocumentsPresent: boolean;
    clinicalRationaleIncluded: boolean;
    policyCitationIncluded: boolean;
    evidenceIndexComplete: boolean;
    qualityAuditPassed: boolean;
    noReworkRequired: boolean;
  };
  routing: {
    reviewerQueueSelected: boolean;
    reviewerConflictCheckComplete: boolean;
    finalDecisionOutsideIncentive: true;
  };
  updatedAt: string;
}
```

## Workflow

The modal should use a compact stepper like Specialty Rx, but Appeals needs more workflow steps:

1. `Start Appeal`: create `APL-*` from a denied `PA-*`. Set `appealReceivedAt` immediately. This starts the main packet-readiness SLA.
2. `Acknowledge Receipt`: set `acknowledgedAt`. This is a sub-SLA milestone, not the start of the main SLA.
3. `Validate Intake`: confirm appeal request, appellant authorization, member match, and requested service match.
4. `Retrieve Original PA Decision`: link denial reason, prior decision summary, and coverage policy citation source.
5. `Resolve Missing Info`: either mark no missing info required or document that missing info was requested and resolved.
6. `Assemble Packet`: confirm required documents, clinical rationale, policy citation, prior decision summary, quality audit, and no rework.
7. `Index Evidence`: confirm appeal evidence index is complete and PHI-safe for policy/payment metadata.
8. `Route Reviewer`: route to the reviewer queue and mark `packetReadyAt`. This triggers business policy evaluation and any eligible policy-bound settlement.

The final appeal decision is deliberately not represented as a payable milestone.

## SLA Semantics

The main packet-readiness SLA starts at `appealReceivedAt`, not `acknowledgedAt`.

- standard packet-readiness SLA: 24 business hours
- expedited packet-readiness SLA: 4 business hours
- acknowledgement sub-SLA: 2 business hours from `appealReceivedAt`
- main SLA stop: `packetReadyAt`

The demo should label this as a contract operations SLA. It is not a regulatory replacement. CMS Part C reconsideration timelines are broader appeal-decision deadlines that run from when the plan receives the request, such as 72 hours for expedited pre-service or Part B drug requests and 30 calendar days for standard pre-service requests.

For implementation simplicity, the first version can compute elapsed hours using wall-clock hours, as Specialty Rx does. The UI copy and policy controls should say "business hours" because that is the contract intent. If exact business-calendar calculation is needed later, add it as a focused enhancement.

## Policy Evidence

Add an `appeals_packet_quality` event evaluator and policy-engine branch. Evidence should include:

- `appealId`
- `umRequestId`
- `planId`
- `submitterId`
- `requestType`
- `originalOutcomeStatus`
- `appealReceivedAt`
- `acknowledgedAt`
- `packetReadyAt`
- `acknowledgedWithinSla`
- `packetReadyWithinSla`
- `requiredDocumentsPresent`
- `clinicalRationaleIncluded`
- `policyCitationIncluded`
- `priorDecisionSummaryIncluded`
- `evidenceIndexComplete`
- `qualityAuditPassed`
- `noReworkRequired`
- `appealOutcomeUsed: false`
- `costSavingsMetricUsed: false`
- `denialReversalMetricUsed: false`
- `containsPhi: false`

Expected block reasons include:

- `LINKED_PA_NOT_DENIED`
- `ACKNOWLEDGEMENT_SLA_EXCEEDED`
- `PACKET_READINESS_SLA_EXCEEDED`
- `REQUIRED_DOCUMENTS_MISSING`
- `CLINICAL_RATIONALE_MISSING`
- `POLICY_CITATION_MISSING`
- `PRIOR_DECISION_SUMMARY_MISSING`
- `EVIDENCE_INDEX_INCOMPLETE`
- `QUALITY_AUDIT_FAILED`
- `REWORK_REQUIRED`
- `PROHIBITED_APPEAL_OUTCOME_METRIC`
- `PROHIBITED_COST_SAVINGS_METRIC`
- `PROHIBITED_DENIAL_REVERSAL_METRIC`
- `PHI_IN_PAYMENT_METADATA`

## Data And Storage

Mirror Specialty Rx storage patterns:

- `appealCases`
- `appealsPlanAuditRows`
- `createAppealsCaseStoreFromEnv`
- memory backend for tests
- Firestore backend for demo persistence

`AppealCase.id` should be derived deterministically from `umRequestId` by replacing `PA-` with `APL-`. `startAppeal(umRequestId)` must be idempotent: if the appeal already exists, return it.

## API Surface

Provider/appeals workqueue:

- `GET /api/appeals/prior-auths` returns PA rows decorated with appeal eligibility and existing appeal case summary.
- `POST /api/appeals/cases` accepts `{ umRequestId, expedited?: boolean }` and creates or returns the one appeal case for that PA.
- `GET /api/appeals/workqueue` returns active appeal cases.
- `POST /api/appeals/cases/[appealId]/acknowledge`
- `POST /api/appeals/cases/[appealId]/intake`
- `POST /api/appeals/cases/[appealId]/original-decision`
- `POST /api/appeals/cases/[appealId]/missing-info`
- `POST /api/appeals/cases/[appealId]/packet`
- `POST /api/appeals/cases/[appealId]/evidence-index`
- `POST /api/appeals/cases/[appealId]/route-reviewer`

Plan audit:

- `GET /api/appeals/plan` returns pending and terminal Appeals audit rows.

## UI

Add three views:

- `/appeals`: provider appeals console, all PAs, eligibility statuses, start/open appeal actions, workflow modal
- `/appeals/plan`: health-plan audit console for appeals packet incentives
- `/appeals/policies`: read-only Appeals business policy and Hedera settlement policy catalog

Navigation should match the existing use-case navigation pattern:

- Provider Appeals View
- Health Plan View
- Policies View

The provider appeals console should be dense and operational like the other app surfaces. It should not become a landing page.

## Payment And Identity

Keep one appeal per PA so the existing settlement identity can remain:

```ts
buildBusinessEvaluationId({
  umRequestId: appealCase.umRequestId,
  businessPolicyId
});
```

The audit row should carry both identifiers:

- `umRequestId` for settlement compatibility
- `appealId` for workflow traceability

The Hedera payment memo/path must not include PHI or appeal packet details.

## Error Handling

- Starting an appeal for a missing PA returns `UM_REQUEST_NOT_FOUND`.
- Starting an appeal for a non-determined PA returns `PA_NOT_DETERMINED`.
- Starting an appeal for an approved PA returns `PA_NOT_APPEAL_ELIGIBLE`.
- Starting a second appeal for the same PA returns the existing appeal case, not an error.
- Step APIs reject malformed bodies before workflow mutation.
- Step APIs reject out-of-order transitions with `APPEAL_INVALID_STATE`.
- Terminal settlement is idempotent and does not duplicate payment if the terminal row already has a submitted payment intent or transaction.

## Testing

Use TDD for implementation. Initial failing tests should cover:

- denied PA appears as startable in the Appeals provider console payload
- approved and pending PAs are visible but not startable
- `startAppeal` creates one deterministic `APL-*` case per denied PA and is idempotent
- `appealReceivedAt` starts the packet-readiness SLA; delaying acknowledgement does not reset the main clock
- full workflow advances through all steps and produces a paid plan row
- missing document/evidence/rationale blocks business policy
- packet ready outside SLA blocks business policy
- appeal outcome and cost savings fields block if ever set true
- API route parsers reject malformed step bodies
- UI renders the PA list, `Start appeal`, `Open appeal`, and all workflow step labels
- policies view contains Appeals Packet Quality, packet-readiness SLA, and no outcome incentive language

Final verification should include targeted tests, typecheck, lint, build, `git diff --check`, and browser verification of `/appeals`, `/appeals/plan`, and `/appeals/policies`.

## Open Scope Decisions

Resolved:

- one appeal per PA for this demo
- provider starts appeals by choosing from all visible PAs
- only denied determined PAs are appeal-eligible
- separate `AppealCase` entity linked to `UMRequest`
- final appeal decision remains outside incentive logic

Deferred:

- exact business-calendar SLA computation
- multiple appeal levels or reopening cycles for a single PA
- external document upload or real appeal packet content
