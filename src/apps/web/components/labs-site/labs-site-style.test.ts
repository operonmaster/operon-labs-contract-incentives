import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Labs proof stylesheet", () => {
  it("uses the proof namespace and removes retired draft namespaces", () => {
    const css = readRepoFile("src/apps/web/app/styles.css");

    expect(css).toContain(".labs-proof-page");
    expect(css).toContain(".labs-proof-nav");
    expect(css).toContain(".labs-proof-portal-grid");
    expect(css).toContain(".labs-proof-proof-grid");
    expect(css).not.toMatch(/\.labs-magazine-/);
    expect(css).not.toMatch(/\.labs-draft-/);
  });
});
