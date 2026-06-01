import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Labs UX polish", () => {
  it("gives homepage hero CTAs their own visual rhythm", () => {
    const css = readRepoFile("src/apps/web/app/styles.css");

    expect(css).toMatch(/\.op-hero-copy\s*\{[^}]*display: grid;[^}]*gap: 24px;/s);
    expect(css).toMatch(
      /\.labs-proof-page \.op-hero:not\(\.compact\) h1\s*\{[^}]*font-size: 62px;[^}]*font-weight: 400;[^}]*line-height: 1\.02;/s
    );
    expect(css).toMatch(
      /@media \(max-width: 860px\)[\s\S]*\.labs-proof-page \.op-hero:not\(\.compact\) h1\s*\{[\s\S]*font-size: 46px;[\s\S]*line-height: 1\.03;/s
    );
    expect(css).toMatch(/\.labs-proof-page \.op-hero\s*\{[^}]*padding: 32px 0 34px;/s);
  });

  it("aligns the Labs brand treatment with the Operon brief system", () => {
    const css = readRepoFile("src/apps/web/app/styles.css");

    expect(css).toMatch(/\.labs-proof-brand-mark\s*\{[^}]*height: 30px;[^}]*width: 30px;/s);
    expect(css).toMatch(/\.labs-proof-brand-text\s*\{[^}]*font-family: var\(--op-font-sans\)/s);
    expect(css).toMatch(/\.labs-proof-brand-text\s*\{[^}]*font-size: 18px;/s);
    expect(css).toMatch(/\.labs-proof-page::before\s*\{[^}]*rgba\(96, 165, 250, 0\.055\)/s);
  });

  it("keeps Labs mobile navigation compact instead of wrapping into stacked rows", () => {
    const css = readRepoFile("src/apps/web/app/styles.css");

    expect(css).toMatch(
      /@media \(max-width: 860px\)[\s\S]*\.labs-proof-nav\s*\{[\s\S]*grid-template-areas: "brand cta" "links links";/s
    );
    expect(css).toMatch(/@media \(max-width: 860px\)[\s\S]*\.labs-proof-nav-links\s*\{[\s\S]*overflow-x: auto;/s);
    expect(css).toMatch(/@media \(max-width: 860px\)[\s\S]*\.labs-proof-nav-links a\s*\{[\s\S]*flex: 0 0 auto;/s);
  });

  it("keeps the promoted homepage bridge cards compact and balanced", () => {
    const css = readRepoFile("src/apps/web/app/styles.css");

    expect(css).toMatch(
      /\.labs-home-snapshot-grid\s*\{[^}]*grid-template-columns: minmax\(0, 0\.9fr\) minmax\(0, 1\.1fr\);/s
    );
    expect(css).toMatch(/\.labs-home-compact-frame\s*\{[^}]*grid-template-rows: auto minmax\(0, 1fr\);/s);
    expect(css).toMatch(/\.labs-home-mini-sequence\s*\{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/s);
    expect(css).toMatch(/\.labs-home-demo-sequence strong\s*\{[^}]*font-size: 11px;/s);
    expect(css).toMatch(
      /@media \(max-width: 560px\)[\s\S]*\.labs-home-mini-sequence\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/s
    );
  });

  it("keeps the homepage portal cards visually balanced after the platform spine removal", () => {
    const css = readRepoFile("src/apps/web/app/styles.css");

    expect(css).toMatch(/\.labs-proof-portal-grid\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/s);
  });
});
