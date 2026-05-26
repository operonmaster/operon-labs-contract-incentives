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
    expect(source).toContain("export function LabsBadge");
    expect(source).toContain('export { LabsSelect } from "./LabsSelect"');
  });

  it("exposes a custom Labs select primitive inspired by the platform dropdown", () => {
    const selectPath = "src/apps/web/components/labs-ui/LabsSelect.tsx";

    expect(existsSync(repoFile(selectPath))).toBe(true);

    const source = readRepoFile(selectPath);
    const css = readRepoFile("src/apps/web/app/styles.css");

    expect(source).toContain('"use client"');
    expect(source).toContain("export interface LabsSelectOption");
    expect(source).toContain("export function LabsSelect");
    expect(source).toContain('role="combobox"');
    expect(source).toContain('role="listbox"');
    expect(source).toContain('role="option"');
    expect(source).toContain("labs-select-backdrop");
    expect(source).toContain("labs-select-chevron");
    expect(source).toContain("labs-select-check");
    expect(source).toContain("navigateOptions");
    expect(css).toContain(".labs-select");
    expect(css).toContain(".labs-select-trigger");
    expect(css).toContain(".labs-select-menu");
    expect(css).toContain(".labs-select-option");
    expect(css).toContain(".labs-select-trigger[aria-expanded=\"true\"]");
  });

  it("exposes a compact Operon-style shared badge primitive", () => {
    const uiSource = readRepoFile("src/apps/web/components/labs-ui/index.tsx");
    const css = readRepoFile("src/apps/web/app/styles.css");

    expect(uiSource).toContain('variant?: "success" | "warning" | "info" | "neutral"');
    expect(uiSource).toContain("op-badge");
    expect(uiSource).toContain("op-badge-${variant}");
    expect(css).toContain(".op-badge");
    expect(css).toContain("border-radius: 6px;");
    expect(css).toMatch(/\.op-badge \{[^}]*font-weight: 500;/);
    expect(css).toContain(".op-badge-success");
    expect(css).toContain(".op-badge-warning");
    expect(css).toContain(".op-badge-info");
  });

  it("centers shared badges when they are rendered in table columns", () => {
    const css = readRepoFile("src/apps/web/app/styles.css");
    const planConsole = readRepoFile("src/apps/web/components/provider-documentation/PlanIncentivesConsole.tsx");
    const auditModal = readRepoFile("src/apps/web/components/provider-documentation/PlanAuditDetailsModal.tsx");

    expect(css).toContain(".badge-cell");
    expect(css).toMatch(/\.badge-cell \{[^}]*text-align: center;/);
    expect(css).toMatch(/\.badge-cell \.op-badge \{[^}]*margin-inline: auto;/);
    expect(planConsole).toContain('<th className="badge-cell">Business Policy</th>');
    expect(planConsole).toContain('<td className="badge-cell">');
    expect(auditModal).toContain('<th className="badge-cell">Result</th>');
    expect(auditModal).toContain('<td className="badge-cell">');
  });

  it("uses the shared badge primitive for visible status labels across pages", () => {
    const demoPage = readRepoFile("src/apps/web/components/DemoPage.tsx");
    const providerPortal = readRepoFile("src/apps/web/components/provider-documentation/ProviderDocumentationWizard.tsx");
    const planConsole = readRepoFile("src/apps/web/components/provider-documentation/PlanIncentivesConsole.tsx");
    const policyConsole = readRepoFile("src/apps/web/components/provider-documentation/PolicyConsole.tsx");

    for (const source of [demoPage, providerPortal, planConsole, policyConsole]) {
      expect(source).toContain("LabsBadge");
      expect(source).not.toContain('className="status');
      expect(source).not.toContain("className={`status");
      expect(source).not.toContain("assessment-pill");
    }
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
