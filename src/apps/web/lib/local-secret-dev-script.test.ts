import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("local real-settlement dev script", () => {
  it("uses a top-level Operon-style startup script and keeps secrets in process env", () => {
    const script = readRepoFile("run-local-server.sh");

    expect(script).toContain("Operon Labs Contract Incentives");
    expect(script).toContain("Local Development Server");
    expect(script).toContain("LOCAL_URL=");
    expect(script).toContain("Press Ctrl+C to stop the server");
    expect(script).toContain("gcloud secrets versions access latest");
    expect(script).toContain("contract-incentives-hedera-operator-account-id");
    expect(script).toContain("contract-incentives-hedera-operator-private-key");
    expect(script).toContain("contract-incentives-hedera-allowed-recipient-account-ids");
    expect(script).toContain("export HEDERA_OPERATOR_ACCOUNT_ID");
    expect(script).toContain("export HEDERA_OPERATOR_PRIVATE_KEY");
    expect(script).toContain("export HEDERA_ALLOWED_RECIPIENT_ACCOUNT_IDS");
    expect(script).toContain("npm --workspace @operon-labs/web run dev");
    expect(script).not.toMatch(/>\s*\.env/);
    expect(script).not.toContain("set -x");
  });

  it("exposes npm scripts for simulated and real local dev", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as { scripts: Record<string, string> };

    expect(packageJson.scripts["dev:real"]).toBe("./run-local-server.sh");
    expect(packageJson.scripts["dev:simulated"]).toBe("HEDERA_SETTLEMENT_MODE=simulated npm run dev");
  });
});
