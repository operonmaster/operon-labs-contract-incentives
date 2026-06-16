import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("vitest setup persistence guard", () => {
  it("normalizes backend values and forces blank test backends to memory", () => {
    const source = readFileSync(resolve(process.cwd(), "vitest.setup.ts"), "utf8");

    expect(source).toContain("forceTestBackend");
    expect(source).toContain("normalizeBackend");
    expect(source).toContain("value?.trim().toLowerCase()");
    expect(source).toContain("process.env[name] = \"memory\"");
    expect(source).toContain('normalizeBackend(value) === "firestore"');
  });
});
