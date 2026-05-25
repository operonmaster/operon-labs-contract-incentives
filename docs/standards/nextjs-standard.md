# Next.js Standard

**Version:** 1.0.0  
**Status:** MANDATORY  
**Last Updated:** 2026-05-24  
**Scope:** `operon-labs-contract-incentives` Next.js app, server routes, container build, and Cloud Run deployment.

This standard adapts the Operon platform Angular and CI/CD standards for the first Operon Labs Next.js application. The rule is the same as the platform repo: application code ships through container images; Terraform owns infrastructure shape, IAM, DNS, runtime env vars, and service creation.

## Stack Requirements

| Component | Required Version | Current Repo Version |
|-----------|------------------|----------------------|
| Node.js runtime | 24.x Active LTS | `node:24-alpine`, `.nvmrc = 24` |
| npm | 10.8+ | local verified `10.8.2`; Node 24 images may use npm 11.x |
| Next.js | latest stable 16.x | `16.2.6` |
| React / React DOM | latest stable 19.x | `19.2.6` |
| TypeScript | latest stable 6.x | `6.0.3` |
| ESLint | latest resolver-clean major supported by Next config | `9.39.4` |
| eslint-config-next | match Next.js version | `16.2.6` |
| Vitest | latest stable | `4.1.7` |
| Package manager | npm only | npm workspaces |

Node 24 is the production target because it is the current Active LTS line. Next.js 16 requires Node.js `20.9.0+`, but new Operon Labs production workloads should not target Node 20 because it is no longer the correct new-service baseline.

Do not use yarn, pnpm, Bun, or ad hoc package manager lockfiles.

## Version Verification

Run these commands before changing framework/runtime versions:

```bash
node --version
npm --version
npm view next version
npm view next@$(npm view next version) engines --json
npm view react version
npm view react-dom version
npm view typescript version
npm view eslint-config-next version
npm view vitest version
```

If `npm view eslint version` returns a newer major than the repo uses, do not force it with `--force` or `--legacy-peer-deps`. First verify a clean resolver path with `npm install` and confirm `npm run lint` succeeds. As of 2026-05-24, ESLint 10 is published, but a normal npm resolver run rejected the upgrade against the current lock/dependency graph; keep ESLint 9 until the clean path is available.

## Project Structure

```text
src/
  apps/web/
    app/                    Next.js App Router routes and route handlers
    components/             React components scoped to the web app
    lib/                    Web-app-specific orchestration helpers
    next.config.ts          Next runtime/build config
    tsconfig.json           App-local TypeScript config
  packages/
    audit-log/              Shared audit helpers
    hedera-executor/        Hedera execution boundary
    incentive-agent/        Policy orchestration
    policy-engine/          Deterministic policy evaluator
    um-platform/            Synthetic UM/PAS platform
  mock-data/                Synthetic demo data
```

Use npm workspaces for internal packages. Import internal packages through workspace package names, not deep relative paths across package boundaries.

## Rendering Model

Use the App Router. Default to server components and server route handlers. Add `"use client"` only when a component needs browser-only interactivity such as state, effects, modal controls, or direct DOM events.

Use route handlers for server-side API surfaces. Browser code must not talk directly to GCP services such as Firestore. GCP access belongs in server-only modules or route handlers using Cloud Run Application Default Credentials.

## Next.js Runtime Configuration

`next.config.ts` must keep:

```ts
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(appDirectory, "../../.."),
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: [
    "@operon-labs/audit-log",
    "@operon-labs/hedera-executor",
    "@operon-labs/incentive-agent",
    "@operon-labs/policy-engine",
    "@operon-labs/um-platform"
  ]
};
```

`output: "standalone"` is required for the Cloud Run container. `outputFileTracingRoot` must point at the repository root because the app depends on workspace packages outside `src/apps/web`.

## TypeScript And Linting

TypeScript is strict and no-emit. Keep the root `tsconfig.json` as the repo-wide source for workspace path aliases. Web-specific type checks must run through:

```bash
npm run typecheck
```

Lint through ESLint directly:

```bash
npm run lint
```

Do not use `next lint`; Next.js 16 removed that command. Do not bypass lint/type failures for demo speed.

## Testing

Unit and route-handler tests use Vitest.

Required checks before merging or deploying:

```bash
npm run lint
npm test
npm run typecheck
npm run build
```

When deployment assets change, also run:

```bash
docker build --platform linux/amd64 --build-arg ENVIRONMENT=nonprod -t contract-incentives-web:check .
docker run --rm -p 18080:8080 -e PORT=8080 contract-incentives-web:check
curl -fsS -I http://localhost:18080/
```

The container must listen on `PORT=8080`.

## Container Standard

Use the root `Dockerfile`. It must remain a two-stage build:

1. `node:24-alpine` builder
2. `node:24-alpine` runtime

The runtime image must:

- run as a non-root `operon` user
- set `NODE_ENV=production`
- set `NEXT_TELEMETRY_DISABLED=1`
- set `HOSTNAME=0.0.0.0`
- set `PORT=8080`
- run `node src/apps/web/server.js`

Do not copy local `.next`, `node_modules`, `.env`, credentials, Terraform files, or docs-only output into the image. Maintain `.dockerignore` for that boundary.

## Cloud Run And CI/CD

Use the platform-style split:

- `make ci-validate` validates source.
- `make ci-build` builds and pushes the image.
- `make deploy` updates the image on an existing Terraform-managed Cloud Run service.
- `make ci-all ENV=nonprod` runs the full local pipeline.

`ENV=prod` is invalid for this repo. The only environment is `nonprod` because the public hackathon app is backed by `operon-labs-nonprod`.

Image publishing uses two tags: the immutable build tag plus generic `latest`. This repo is environment-scoped by GCP project, so `latest` is unambiguous inside `operon-labs-nonprod`. Deployments use the `latest` tag while the immutable tag remains available for traceability.

The deployment script must pass `--cpu-throttling` and must not set infrastructure flags. It may update the image and Terraform-aligned labels only. It must fail if the Cloud Run service does not already exist, because Terraform owns service creation.

Terraform must ignore Cloud Run image drift for this service so CI/CD can own revision images while Terraform owns service shape. The infra layer should preserve the platform pattern:

```hcl
lifecycle {
  ignore_changes = [
    client,
    client_version,
    scaling,
    template[0].containers[0].image,
    template[0].revision
  ]
}
```

## Runtime Configuration

Runtime env vars are owned by Terraform, not the app repo deploy script.

Required deployed env vars:

```text
ENVIRONMENT=nonprod
NODE_ENV=production
PAS_STORE_BACKEND=firestore
UM_REFERENCE_STORE_BACKEND=firestore
POLICY_STORE_BACKEND=firestore
PAYMENT_INTENT_STORE_BACKEND=firestore
GCP_PROJECT_ID=operon-labs-nonprod
FIRESTORE_DATABASE_ID=(default)
HEDERA_SETTLEMENT_MODE=real
HEDERA_NETWORK=testnet
HEDERA_OPERATOR_ACCOUNT_ID=<Secret Manager value>
HEDERA_OPERATOR_PRIVATE_KEY=<Secret Manager value>
HEDERA_ALLOWED_RECIPIENT_ACCOUNT_IDS=0.0.9049549
HEDERA_BLOCKED_RECIPIENT_ACCOUNT_IDS=
HEDERA_MAX_PAYMENT_HBAR=5
```

Local development and deployed Cloud Run default to Firestore. Use `PAS_STORE_BACKEND=memory`, `UM_REFERENCE_STORE_BACKEND=memory`, `POLICY_STORE_BACKEND=memory`, and `PAYMENT_INTENT_STORE_BACKEND=memory` only for isolated tests or offline demos.

Hedera settlement defaults to real testnet execution. Use `HEDERA_SETTLEMENT_MODE=simulated` only for isolated tests or offline demos. The public repo must never contain Hedera private keys.

Incentive amount, caps, recipient wallet mapping, and token symbol must come from the selected `incentivePolicies/{evaluationType}` Firestore document. Runtime code must not read YAML policy files or hardcoded policy constants for evaluation. The current real settlement adapter supports HBAR only; policies may model future `USDC`, `OPER`, or `OPRN` payouts, but those require a token-transfer adapter before they can be marked settled.

Hedera Agent Kit hooks are the settlement-control boundary, not a duplicate CRD/DTR/PAS eligibility engine. Agent Kit execution policy must enforce duplicate-payment prevention through `paymentIntents/{paymentIntentId}`, recipient allow/deny lists, exact transfer-envelope integrity, and max HBAR per request before the HBAR transfer tool can run.

## Security Boundary

This is a public repo. Do not commit:

- Terraform state
- service account keys
- `.env` files
- private project bootstrapping details
- privileged IAM bindings
- real PHI or production payer/provider data

Synthetic healthcare data is allowed. Policy-safe evidence may be passed to the incentive layer. Full FHIR/PAS payloads should stay server-side and should not be sent to Hedera-facing execution code unless explicitly scrubbed.

## References

- Node.js releases: https://nodejs.org/en/about/releases/
- Node.js release schedule: https://github.com/nodejs/release
- Next.js 16 release notes: https://nextjs.org/blog/next-16
- Next.js installation requirements: https://nextjs.org/docs/pages/getting-started/installation
- Next.js deployment modes: https://nextjs.org/docs/app/getting-started/deploying
