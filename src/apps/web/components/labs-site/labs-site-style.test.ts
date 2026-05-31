import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Labs magazine stylesheet", () => {
  it("uses the magazine namespace and removes the overloaded draft namespace", () => {
    const css = readRepoFile("src/apps/web/app/styles.css");

    expect(css).toContain(".labs-magazine-page");
    expect(css).toContain(".labs-magazine-nav");
    expect(css).toContain(".labs-magazine-portal-grid");
    expect(css).toContain(".labs-magazine-experiment-grid");
    expect(css).not.toMatch(/\.labs-draft-/);
  });
});
