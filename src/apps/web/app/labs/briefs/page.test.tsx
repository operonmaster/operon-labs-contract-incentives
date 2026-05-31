import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("BriefsPage", () => {
  it("redirects the retired briefs route to signals", () => {
    const source = readRepoFile("src/apps/web/app/labs/briefs/page.tsx");

    expect(source).toContain('from "next/navigation"');
    expect(source).toContain('redirect("/labs/signals")');
    expect(source).not.toContain("Briefs from the healthcare proof layer.");
  });
});
