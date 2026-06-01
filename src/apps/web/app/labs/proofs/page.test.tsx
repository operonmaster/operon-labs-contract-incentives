import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("ProofsRedirectPage", () => {
  it("redirects the retired proofs route to initiatives", () => {
    const source = readRepoFile("src/apps/web/app/labs/proofs/page.tsx");

    expect(source).toContain('from "next/navigation"');
    expect(source).toContain('redirect("/labs/initiatives")');
    expect(source).not.toContain("Proofs you can inspect.");
    expect(source).not.toContain("Working models you can inspect.");
  });
});
