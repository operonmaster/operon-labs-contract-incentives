import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function repoFile(path: string) {
  return resolve(process.cwd(), path);
}

function readRepoFile(path: string) {
  return readFileSync(repoFile(path), "utf8");
}

describe("Operon Labs design system", () => {
  it("ports the Operon presentation design tokens into the app stylesheet", () => {
    const css = readRepoFile("src/apps/web/app/styles.css");

    expect(css).toContain("family=Geist");
    expect(css).toContain("--op-bg: #050816");
    expect(css).toContain("--op-bg-2: #0a0f1f");
    expect(css).toContain("--op-blue: #3b82f6");
    expect(css).toContain("--op-green: #10b981");
    expect(css).toContain("--op-amber: #f59e0b");
    expect(css).toContain("--op-slide-w: 1920px");
    expect(css).toContain("--op-slide-h: 1080px");
    expect(css).toContain(".op-grid-bg");
    expect(css).toContain(".op-product-frame");
    expect(css).toContain(".op-deck-rail");
  });

  it("exposes shared UI primitives for Labs app and deck surfaces", () => {
    const uiPath = "src/apps/web/components/labs-ui/index.tsx";

    expect(existsSync(repoFile(uiPath))).toBe(true);

    const source = readRepoFile(uiPath);
    expect(source).toContain("export function LabsPageShell");
    expect(source).toContain("export function LabsHero");
    expect(source).toContain("export function LabsPanel");
    expect(source).toContain("export function LabsProductFrame");
    expect(source).toContain("export function LabsDeckRail");
  });

  it("uses the shared Labs shell on the primary demo pages", () => {
    const homePage = readRepoFile("src/apps/web/app/page.tsx");
    const demoPage = readRepoFile("src/apps/web/components/DemoPage.tsx");
    const providerPortal = readRepoFile("src/apps/web/components/provider-documentation/ProviderDocumentationWizard.tsx");
    const planConsole = readRepoFile("src/apps/web/components/provider-documentation/PlanIncentivesConsole.tsx");

    expect(homePage).toContain("LabsPageShell");
    expect(demoPage).toContain("LabsPageShell");
    expect(providerPortal).toContain("LabsPageShell");
    expect(planConsole).toContain("LabsPageShell");
  });
});
