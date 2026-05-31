import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("AboutPage", () => {
  it("redirects the retired about route to method", () => {
    const source = readRepoFile("src/apps/web/app/labs/about/page.tsx");

    expect(source).toContain('from "next/navigation"');
    expect(source).toContain('redirect("/labs/method")');
    expect(source).not.toContain("How Operon Labs works.");
  });
});
