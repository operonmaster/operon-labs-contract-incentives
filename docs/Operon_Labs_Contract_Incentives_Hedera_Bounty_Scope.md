# Operon Labs Contract Incentives

## Working Summary

Operon Labs Contract Incentives is a policy-gated incentive layer for healthcare operations. Business applications submit structured evidence about work performed. A shared AI/policy agent selects the applicable contract policy, evaluates the submitted evidence, computes the incentive amount, maps the approved submitter to a wallet, and executes a policy-defined token payment only when the policy conditions are met. The bootstrapped Hedera bounty path uses HBAR, while the platform policy model can represent HBAR, USDC, OPER, OPRN, or another explicitly configured token.

The core business claim:

> Healthcare organizations should be able to reward measurable operational quality under explicit contract rules, with auditability, capped exposure, pre-authorized policy controls, and safeguards against incentives tied to inappropriate outcomes such as denials, referral volume, or cost avoidance.

This is not a generic payment bot. It is a reusable infrastructure pattern for contract-governed healthcare incentives.

## Target Bounty

Target bounty: Week 5, Hedera Policy Agent.

Week 5 positioning:

- Build a policy-constrained agent payment workflow.
- Use Hedera Agent Kit Hooks and Policies to constrain agent behavior.
- Enable policy-defined payments, with the submitted demo using HBAR and the model supporting future HBAR, USDC, OPER, or OPRN policies.
- Show practical policies such as spend limits, allowed counterparties, and contextual approval logic.
- Demonstrate services or workflows where the policy layer is clearly integrated into the interface and execution flow.

Source references:

- Hedera AI Agent Bounty Campaign page: https://ai-bounties.hedera.com/
- Terms and Conditions: https://ai-bounties.hedera.com/terms-and-conditions
- Hedera Agent Kit Hooks and Policies: https://docs.hedera.com/hedera/open-source-solutions/ai-studio-on-hedera/hedera-ai-agent-kit/hooks-and-polices

## Functional Scope

The implementation will contain four small demo business apps plus one shared incentive evaluation and payment layer.

### Shared Incentive Layer

The shared layer accepts evaluation requests from business apps:

```json
{
  "evaluationType": "delegate_um_sla_bonus",
  "submitter": {
    "type": "delegate_vendor",
    "id": "northstar-um"
  },
  "requestObject": {
    "caseId": "PA-260524-2102-DELEGATE",
    "completedWithinSla": true,
    "documentationComplete": true,
    "reworkRequired": false,
    "qualityAuditPassed": true,
    "denialOutcomeUsed": false,
    "containsPhi": false
  }
}
```

The shared layer performs the following steps:

1. Receive evaluation request.
2. Identify submitter and contract context.
3. Select matching policy by `evaluationType`, submitter type, submitter ID, and contract status.
4. Validate the evidence object against required fields.
5. Run deterministic policy checks.
6. Use the AI agent to summarize, route, and explain the decision, but not to override policy controls.
7. Compute incentive amount from the policy if approved.
8. Map approved submitter to a wallet.
9. Verify explicit plan consent through pre-authorized policy guardrails, or route to human approval when the policy requires it.
10. Execute HBAR or USDC payment through Hedera Agent Kit when the policy permits auto-settlement.
11. Record audit trail: request hash, policy ID/version, decision, reason codes, transaction ID.

### Demo App 1: Provider Documentation Completeness

Business purpose: reward provider admin teams for submitting complete prior-auth-ready documentation upfront.

Submitter:

- provider group or provider administrative team

Policy evaluates:

- required evidence present
- attachment checklist complete
- submitted before initial decision
- required FHIR/profile fields present where applicable
- no referral-volume metric used
- no approval/denial outcome metric used
- no payment tied to service volume or provider steering
- no PHI on-chain or in payment metadata

Incentive trigger:

- provider submitted clean documentation that reduces avoidable back-and-forth
- `PAS_SUBMITTED` event carries only `caseId`; the incentive agent pulls policy-safe evidence from the UM Platform
- eligible requests auto-settle on Hedera testnet under the plan's pre-authorized policy guardrails
- non-covered or incomplete-documentation requests are still submitted, but policy blocks payment and records `0 HBAR`

### Demo App 2: Delegate UM SLA Bonus

Business purpose: reward delegated UM vendors for timely, complete, audit-ready operational work.

Submitter:

- delegated UM vendor

Policy evaluates:

- SLA met
- documentation complete
- quality audit passed
- no rework required
- submitter is approved
- recipient wallet is approved
- incentive not tied to denial rate, approval rate, medical spend, or avoided utilization
- no PHI on-chain or in payment metadata

Incentive trigger:

- vendor completed work under contract quality terms

### Exception Path: Appeals Packet Quality

Business purpose: reward appeals teams for complete, timely, well-rationalized appeal packets.

Submitter:

- appeals delegate, provider ops team, or plan appeals operations partner

Policy evaluates:

- packet submitted within SLA
- required documents present
- clinical rationale included
- policy citation included
- prior decision summary included
- evidence index complete
- quality audit passed
- no rework required
- payment not tied to appeal outcome
- payment not tied to cost savings
- no PHI on-chain or in payment metadata

Incentive trigger:

- appeal packet is complete, timely, and audit-ready

### Demo App 3: Specialty Rx Fulfillment SLA

Business purpose: reward a contracted specialty pharmacy for clean post-approval fulfillment execution after an approved pharmacy prior authorization.

Workflow:

1. Intake & Triage
2. Clear To Fill
3. Schedule Shipment
4. Confirm Fulfillment

Policy guardrails:

- incentive starts from clear-to-fill execution readiness
- no drug-choice, fill-volume, adherence, savings, or pharmacy-steering payout basis
- cold-chain add-on is a handling complexity adjustment
- external blockers are separated from avoidable pharmacy exceptions
- no PHI appears in settlement metadata

## Policy Model

Policies are custom validation rules integrated into the Hedera Agent Kit tool lifecycle. They are not required to be smart contracts. For this project, policies should be implemented as application code using Hedera Agent Kit Hooks and Policies, with optional on-chain audit events.

Policies should own:

- eligible submitter types
- eligible submitter IDs
- wallet mapping
- required evidence fields
- approval rules
- prohibited metrics
- payment formulas
- currency
- amount per eligible request
- monthly caps
- settlement mode: pre-authorized auto-settlement or human approval
- audit fields

Example policy object. The demo stores four objects like this: two plans times two request-type scopes. UI labels are generated from the plan name, provider name, and request type instead of storing a free-text display name.

```yaml
policyId: plcy_8K2M4Q6R9T1V3X5Z7B0C
version: v1
status: active
evaluationType: provider_documentation_completeness
contractPair:
  planId: acme-health-ppo
  planName: Acme Health PPO
  providerId: lakeside-provider-admin
  providerName: Lakeside Provider Admin
effectivePeriod:
  startsOn: "2026-05-01"
  endsOn: null
incentiveScope:
  eligibleRequestTypes:
    - outpatient_service
  includedServiceCodes:
    cpt:
      - "73721"
    ndc: []
eligibilityCriteria:
  appliesOnlyToCoveredBenefits: true
  requiresDtrCompletionWhenRequested: true
payout:
  token: HBAR
  amountPerEligibleRequest: 5
  monthlyCap: 500
settlement:
  mode: auto
  recipientWalletId: "0.0.9049549"
  requiresHumanApproval: false
```

## AI Agent Role

The AI agent should not be the uncontrolled decision-maker for payments. Its role should be:

- understand a user's natural-language request
- identify the right evaluation type when needed
- summarize the submitted evidence
- explain why a policy approved, rejected, or routed a request to manual review
- prepare or execute a policy-bound payment action
- help the user inspect policy details

The deterministic policy engine should make the allow/block/payment-amount decision.

This framing keeps the demo clearly agentic while avoiding unsafe autonomous payment behavior.

## Hedera Implementation Requirements

### Required for Any Submission

The public submission must include:

- Public GitHub repository containing the submission source code.
- Repo remains public and online for at least 90 days after the applicable submission deadline.
- Commit history showing the software or submitted agentic features were created during the campaign period.
- README with clear instructions describing what the agent does and how to use it.
- Hedera Agent Kit JavaScript or Python as a core dependency, or Hedera Payments MCP as the core technology.
- Public demo.
- Feedback GitHub issue submitted to a Hedera Agent Kit JS or Python repository.
- Completed submission form with project name, description, summary, GitHub URL, demo URL, wallet address, implementation details, and feedback link.
- English-language submission materials.

Important repo guidance:

- Do not submit a thin wrapper that hides the real implementation behind a private backend.
- Do not include secrets, private keys, real contracts, PHI, PII, or proprietary Operon platform code.
- Use synthetic healthcare data only.
- Include `.env.example`, setup instructions, and testnet configuration.
- Commit incrementally. A small number of large bulk commits can be presumed ineligible under the rules.

### Week 5-Specific Requirements

For Week 5, the project should:

- implement a policy-constrained agent using Hedera Agent Kit Hooks and Policies
- demonstrate payments in HBAR or USDC
- show spend limits, allowed counterparties, and contextual approval logic
- show that policies constrain agent behavior at runtime
- include a hosted public agent URL, because bounties 3, 4, and 5 require hosted agents; a video-only submission does not qualify
- clearly integrate the policy layer into the UI and execution flow

### Safety Requirements

The agent must be designed so it cannot access, use, transfer, or drain user funds without explicit prior consent. In this demo, consent is represented by a plan-administered contract policy that pre-authorizes bounded testnet auto-settlement for eligible events. Mainnet or higher-risk policies should use human approval or equivalent safeguards.

The demo prevents duplicate payments at the exact settlement intent boundary, not at the healthcare request boundary. Settlement ids are deterministic controls: `businessEvaluationId = ie_sha256(umRequestId | businessPolicyId)` and `paymentIntentId = pi_sha256(umRequestId | businessPolicyId | paymentPolicyId)`. The readable PA/UM request id stays in `umRequestId`, `caseId`, and the Hedera transaction memo. That lets the same UM request produce separate Provider Documentation and Delegate UM incentives while still blocking a repeat of the same `umRequestId + businessPolicyId + paymentPolicyId` payment.

Implementation requirements for safety:

- pre-authorized policy controls before payment submission, or human approval when the policy requires it
- transaction limits
- allowed recipient/wallet list
- approved currency list: HBAR or USDC
- max payment per request
- monthly cap per submitter
- block unknown submitters
- block unapproved wallets
- block PHI in payment metadata
- block prohibited metrics such as denial rate, appeal outcome, referral volume, cost savings, and steering
- clear reason codes for every block, approval, or manual-review decision

If using Hedera Mainnet, implement human-in-the-loop transaction approval or equivalent safeguards. For the bounty demo, prefer testnet unless there is a specific reason to use mainnet.

## Required Hosted Demo Behavior

The hosted demo should make the policy and payment flow obvious.

Recommended demo flow:

1. User opens the hosted app.
2. User selects one of three normal-path demo apps or the exception path:
   - Provider Documentation Completeness
   - Delegate UM SLA Bonus
   - Specialty Rx Fulfillment SLA
   - Appeals Packet Quality
3. Demo app shows a synthetic work item and evidence object.
4. User submits the evidence object for evaluation.
5. Agent identifies the matching policy.
6. UI displays:
   - selected policy
   - required fields
   - passed checks
   - failed checks, if any
   - Business Policy outcome from canonical `businessPolicyStatus` data: `approved` or `rejected`
   - Payment Policy outcome from canonical `paymentPolicyStatus` data: `paid` or `blocked`
   - computed payment amount
   - recipient wallet
   - reason code
7. Policy confirms the request is inside pre-authorized guardrails, or blocks/routes it if not.
8. Hedera Agent Kit executes HBAR or USDC payment for approved auto-settlement cases.
9. UI displays transaction ID and audit record.
10. Audit view shows request hash, policy version, decision, and transaction reference.

## Suggested Repository Structure

```text
operon-labs-contract-incentives/
  apps/
    web/
      app/
      components/
      routes/
  packages/
    incentive-agent/
      request-router.ts
      policy-selector.ts
      decision-explainer.ts
    policy-engine/
      evaluator.ts
      formulas.ts
      validators.ts
    hedera-executor/
      payment-tool.ts
      policy-hooks.ts
      wallet-registry.ts
    audit-log/
      audit-event.ts
      hash.ts
  mock-data/
    delegate-um/
    provider-documentation/
    appeals/
    specialty-rx/
  docs/
    architecture.md
    policy-model.md
    demo-script.md
  README.md
  .env.example
```

Preferred stack:

- TypeScript / Next.js for the hosted demo.
- Hedera Agent Kit JavaScript as the core Hedera dependency.
- Firestore-backed pair-scoped policy definitions in `incentivePolicies/{policyId}`.
- Deterministic TypeScript policy evaluator.
- LLM layer for request classification and decision explanation.
- Hedera testnet for demo payment execution.

## What Must Be Public

The public repo should include the complete submitted demo implementation:

- business demo apps
- shared incentive agent
- policy engine
- Hedera Agent Kit integration
- payment execution code
- policy definitions
- mock data
- README and setup instructions

The public repo should not include:

- real Operon product code
- real customer data
- PHI or PII
- production API keys
- private wallet keys
- real payer/provider contracts
- private analytics or internal workflows

## Acceptance Criteria

The demo is complete when:

- all four business apps can submit synthetic evaluation requests
- the shared layer selects the correct policy for each request
- each policy can approve, reject, and explain decisions
- payment amount is computed by policy, not provided by the incoming request
- blocked requests show clear reason codes
- approved requests either auto-settle under pre-authorized policy guardrails or require human approval, depending on policy configuration
- approved provider-documentation PAS events execute HBAR or USDC payment through Hedera Agent Kit without a manual plan-console approval button
- audit record is created for every decision
- no PHI/PII appears in requests, logs, payment metadata, or on-chain records
- README explains setup, policies, demo scripts, and Hedera integration
- public hosted URL demonstrates the full flow
- feedback issue link is ready for the bounty submission form

## Submission Checklist

- [ ] Choose final repo name.
- [ ] Create public GitHub repo.
- [ ] Commit early and incrementally.
- [ ] Implement hosted demo.
- [ ] Use Hedera Agent Kit JS or Python as core dependency.
- [ ] Implement runtime policies using Hooks and Policies.
- [ ] Execute HBAR or USDC payment in demo.
- [ ] Add pre-authorized policy safeguards, with human approval for any policy that requires it.
- [ ] Add public README and setup steps.
- [ ] Add `.env.example`.
- [ ] Add synthetic demo data only.
- [ ] Submit feedback issue to Hedera Agent Kit JS or Python repo.
- [ ] Include feedback issue link in submission.
- [ ] Submit during Week 5 window: June 15, 2026 at 9:00 UTC through June 21, 2026 at 23:59 UTC.
- [ ] Keep public repo and hosted demo available for at least 90 days after the submission deadline.

## Positioning Line

Operon Labs Contract Incentives is a policy-gated healthcare operations incentive layer: business apps submit evidence, policies determine whether contract incentives are earned, and Hedera executes auditable HBAR or USDC payments only inside explicit plan-approved safety controls.
