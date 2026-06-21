import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readRootFile(filePath: string): string {
  return readFileSync(path.join(process.cwd(), filePath), "utf8");
}

describe("public repository footprint", () => {
  it("keeps private operator files out of Docker build contexts", () => {
    const dockerIgnoreLines = readRootFile(".dockerignore")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    expect(dockerIgnoreLines).toEqual(
      expect.arrayContaining([
        ".claude/",
        "Makefile",
        "cloudbuild-*.yaml",
        "run-local-server.sh",
        "scripts/ci/",
        "*.tfvars",
        "*.tfstate",
        "*.tfstate.*",
        ".terraform/"
      ])
    );
  });
});
