import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirs: string[] = [];
const MIGRATION_SCRIPT_TEST_TIMEOUT_MS = 20_000;

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

describe("migrate-policy-status-model script", () => {
  it("reports unknown payment evidence outcomes during dry runs without coercing them to blocked", () => {
    const result = runMigration(["--dry-run"], {
      incentiveEvaluations: [],
      paymentPolicyEvidences: [
        { id: "paid-doc", data: { outcome: "paid" } },
        { id: "simulated-doc", data: { outcome: "simulated" } },
        { id: "blocked-doc", data: { outcome: "blocked" } },
        { id: "missing-doc", data: {} },
        { id: "corrupt-doc", data: { outcome: { status: "settled" } } }
      ]
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("paymentPolicyEvidences planned updates: 3");
    expect(result.stdout).toContain("outcome=paid: 2");
    expect(result.stdout).toContain("outcome=blocked: 1");
    expect(result.stdout).toContain("paymentPolicyEvidences unknown outcomes skipped: 2");
    expect(result.stdout).toContain("missing-doc");
    expect(result.stdout).toContain("corrupt-doc");
    expect(result.stdout).not.toContain("outcome=blocked: 3");
  }, MIGRATION_SCRIPT_TEST_TIMEOUT_MS);

  it("refuses a confirmed migration when payment evidence outcomes are unknown", () => {
    const result = runMigration(["--confirm"], {
      incentiveEvaluations: [],
      paymentPolicyEvidences: [
        { id: "paid-doc", data: { outcome: "paid" } },
        { id: "missing-doc", data: {} }
      ]
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Refusing to migrate paymentPolicyEvidences with unknown outcomes");
    expect(result.stderr).toContain("missing-doc");
  }, MIGRATION_SCRIPT_TEST_TIMEOUT_MS);
});

function runMigration(args: string[], data: Record<string, Array<{ id: string; data: unknown }>>) {
  const dir = mkdtempSync(join(tmpdir(), "policy-status-migration-"));
  temporaryDirs.push(dir);
  copyFileSync(
    resolve(process.cwd(), "scripts/migrate-policy-status-model.mjs"),
    join(dir, "migrate-policy-status-model.mjs")
  );
  writeFirestoreMock(dir);

  return spawnSync(process.execPath, [join(dir, "migrate-policy-status-model.mjs"), ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      MOCK_FIRESTORE_DATA: JSON.stringify(data)
    }
  });
}

function writeFirestoreMock(dir: string) {
  const packageDir = join(dir, "node_modules", "@google-cloud", "firestore");
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(
    join(packageDir, "package.json"),
    JSON.stringify({
      type: "module",
      exports: "./index.js"
    })
  );
  writeFileSync(
    join(packageDir, "index.js"),
    `export class Firestore {
  constructor() {
    this.data = JSON.parse(process.env.MOCK_FIRESTORE_DATA ?? "{}");
  }

  collection(name) {
    const docs = (this.data[name] ?? []).map((doc) => ({
      id: doc.id,
      ref: { path: name + "/" + doc.id },
      data: () => doc.data
    }));

    return {
      get: async () => ({ size: docs.length, docs })
    };
  }

  batch() {
    return {
      set() {},
      commit: async () => undefined
    };
  }
}
`
  );
}
