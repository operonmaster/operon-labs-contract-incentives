// Force every persistence backend to in-memory for tests. Each store factory
// (create*StoreFromEnv) defaults to "firestore" when its env var is unset or blank,
// which makes tests reach real GCP Firestore and hang on the network. Keep this
// list in sync with every *_STORE_BACKEND env var read under src/apps/web/lib.
const testBackendEnvNames = [
  "PAS_STORE_BACKEND",
  "UM_REFERENCE_STORE_BACKEND",
  "POLICY_STORE_BACKEND",
  "PAYMENT_POLICY_STORE_BACKEND",
  "PAYMENT_POLICY_EVIDENCE_STORE_BACKEND",
  "PAYMENT_INTENT_STORE_BACKEND",
  "SPECIALTY_RX_STORE_BACKEND"
] as const;

function forceTestBackend(name: typeof testBackendEnvNames[number]): void {
  process.env[name] = "memory";
}

function normalizeBackend(value: string | undefined): string {
  return value?.trim().toLowerCase() || "firestore";
}

testBackendEnvNames.forEach(forceTestBackend);
process.env.HEDERA_SETTLEMENT_MODE = "simulated";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Guard: if any store factory still resolves to firestore in tests (e.g. a new
// *_STORE_BACKEND was added without a memory default above), fail loudly instead
// of hanging on a real network call. Constructing the real client requires
// credentials/network; in tests it must never happen.
const firestoreBackedEnv = testBackendEnvNames
  .map((name) => [name, process.env[name]] as const)
  .filter(([, value]) => normalizeBackend(value) === "firestore");

if (firestoreBackedEnv.length > 0) {
  throw new Error(
    `Tests must not use the firestore backend: ${firestoreBackedEnv
      .map(([name]) => name)
      .join(", ")}. Set them to "memory" in vitest.setup.ts.`
  );
}
