import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("MethodPage", () => {
  it("redirects the retired method route to co-innovate", () => {
    const source = readRepoFile("src/apps/web/app/labs/method/page.tsx");

    expect(source).toContain('from "next/navigation"');
    expect(source).toContain('redirect("/labs/co-innovate")');
    expect(source).not.toContain("How Labs turns workflows into proof.");
  });
});
