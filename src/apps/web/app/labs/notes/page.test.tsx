import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("NotesPage", () => {
  it("redirects the retired notes route to signals", () => {
    const source = readRepoFile("src/apps/web/app/labs/notes/page.tsx");

    expect(source).toContain('from "next/navigation"');
    expect(source).toContain('redirect("/labs/signals")');
    expect(source).not.toContain("Field notes from the trust layer.");
  });
});
