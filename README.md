# Operon Labs Contract Incentives

Policy-gated healthcare operations incentive demo for the Hedera hackathon. The demo keeps the public repo focused on app code, mock policies, Hedera Agent Kit integration points, and a simulated testnet execution boundary.

## Structure

```text
docs/
  Operon_Labs_Contract_Incentives_Hedera_Bounty_Scope.md
src/
  apps/web/                  Next.js demo app and API routes
  mock-data/                 Demo payloads for each incentive workflow
  packages/audit-log/        Audit record and hash helpers
  packages/hedera-executor/  Simulated Hedera payment executor
  packages/incentive-agent/  Demo orchestration over policies and requests
  packages/policy-engine/    Deterministic policy evaluator
  packages/um-platform/      Synthetic CRD/DTR/PAS prior-auth platform
  policies/                  Versioned YAML incentive policies
```

## Demo Surfaces

- `/` - demo catalog
- `/delegate-um` - delegated utilization management SLA bonus
- `/provider-documentation` - provider documentation completeness incentive
- `/provider-documentation/incentives` - health-plan audit console for provider documentation incentives
- `/appeals` - appeals packet quality incentive
- `/provider-directory` - provider directory quality incentive

### Provider Documentation Two-Page Demo

Open two browser pages:

- `/provider-documentation` - provider portal prior-auth wizard
- `/provider-documentation/incentives` - health-plan audit console

Demo sequence:

1. In the provider portal, select `Maya Chen`, `Acme Health PPO`, and `Knee MRI after injury`.
2. Check requirements, complete the assessment, and submit the prior authorization.
3. Use the top navigation or confirmation CTA to open the health-plan audit console.
4. Review the `3 USDC` policy-paid row and inspect the Hedera testnet transaction details.
5. Return to the provider portal and submit a second `Knee MRI after injury` request, but skip the assessment.
6. In the plan console, review the `0 USDC` policy-blocked row with missing documentation reasons.
7. Return to the provider portal and submit `Full-body wellness MRI screening` after acknowledging the not-covered warning.
8. In the plan console, review the `0 USDC` policy-blocked row with `BENEFIT_NOT_COVERED`.

## API Routes

- `POST /api/evaluations` - evaluates a demo request against a versioned policy
- `POST /api/payments/approve` - simulates policy-gated payment approval
- `GET /api/audit/[id]` - returns a deterministic demo audit record
- `GET /api/um/prior-auths` - lists synthetic prior-auth submissions
- `POST /api/um/prior-auths` - submits a synthetic prior-auth request
- `GET /api/um/prior-auths/[caseId]/evidence` - returns policy-safe UM evidence
- `GET /api/provider-documentation/incentives` - lists plan-side incentive audit rows
- `POST /api/provider-documentation/incentives/[caseId]/approve` - deprecated demo route; provider-documentation payments auto-settle after policy approval

Provider-documentation incentives are triggered asynchronously after `PAS_SUBMITTED`. The agent receives only the PA `caseId`, pulls policy-safe evidence from the synthetic UM Platform, and records either an automatic testnet transaction or a zero-value policy block.

## Local Development

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
