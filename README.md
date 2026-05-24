# Operon Labs Contract Incentives

Policy-gated healthcare operations incentive demo for the Hedera hackathon. The demo keeps the public repo focused on app code, mock policies, and a simulated Hedera execution boundary.

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
- `/provider-documentation/incentives` - plan-side provider documentation incentives worklist
- `/appeals` - appeals packet quality incentive
- `/provider-directory` - provider directory quality incentive

### Provider Documentation Two-Page Demo

Open two browser pages:

- `/provider-documentation` - provider portal prior-auth wizard
- `/provider-documentation/incentives` - plan-side incentives worklist

Demo sequence:

1. In the provider portal, submit `Knee MRI after injury`.
2. In the plan console, refresh events and review the eligible `3 USDC` incentive row.
3. Approve the testnet payment and inspect the audit/transaction details.
4. Return to the provider portal and submit `Full-body wellness MRI screening` after acknowledging the not-covered warning.
5. In the plan console, refresh events and review the `0 USDC` not-eligible row with `BENEFIT_NOT_COVERED`.

## API Routes

- `POST /api/evaluations` - evaluates a demo request against a versioned policy
- `POST /api/payments/approve` - simulates policy-gated payment approval
- `GET /api/audit/[id]` - returns a deterministic demo audit record
- `GET /api/um/prior-auths` - lists synthetic prior-auth submissions
- `POST /api/um/prior-auths` - submits a synthetic prior-auth request
- `GET /api/um/prior-auths/[caseId]/evidence` - returns policy-safe UM evidence
- `GET /api/provider-documentation/incentives` - lists plan-side incentive rows
- `POST /api/provider-documentation/incentives/[caseId]/approve` - approves an eligible plan-side testnet payment proposal

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
