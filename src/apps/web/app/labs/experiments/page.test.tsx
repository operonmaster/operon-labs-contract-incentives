import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("ExperimentsPage", () => {
  it("redirects the retired experiments route to proofs", () => {
    const source = readRepoFile("src/apps/web/app/labs/experiments/page.tsx");

    expect(source).toContain('from "next/navigation"');
    expect(source).toContain('redirect("/labs/proofs")');
    expect(source).not.toContain("Experiments you can inspect.");
  });
});
