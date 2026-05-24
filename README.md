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
  policies/                  Versioned YAML incentive policies
```

## Demo Surfaces

- `/` - demo catalog
- `/delegate-um` - delegated utilization management SLA bonus
- `/provider-documentation` - provider documentation completeness incentive
- `/appeals` - appeals packet quality incentive
- `/provider-directory` - provider directory quality incentive

## API Routes

- `POST /api/evaluations` - evaluates a demo request against a versioned policy
- `POST /api/payments/approve` - simulates policy-gated payment approval
- `GET /api/audit/[id]` - returns a deterministic demo audit record

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
