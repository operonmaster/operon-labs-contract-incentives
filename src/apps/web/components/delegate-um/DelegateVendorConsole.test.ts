// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import path from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DelegateUmRow } from "../../lib/delegate-um-workflow";
import { DelegateReviewModal } from "./DelegateReviewModal";

describe("DelegateVendorConsole source", () => {
  it("uses delegate UM APIs instead of payment APIs", () => {
    const source = readFileSync(path.join(process.cwd(), "src/apps/web/components/delegate-um/DelegateVendorConsole.tsx"), "utf8");
    const modalSource = readFileSync(path.join(process.cwd(), "src/apps/web/components/delegate-um/DelegateReviewModal.tsx"), "utf8");

    expect(source).toContain("/api/delegate-um/workqueue");
    expect(source).toContain("/api/delegate-um/requests/");
    expect(source).not.toContain("/api/payments");
    expect(source).toContain("lastReviewButtonRef");
    expect(source).toContain("event.currentTarget");
    expect(source).toContain("window.setTimeout(() => lastReviewButtonRef.current?.focus(), 0)");
    expect(modalSource).toContain("closeButtonRef.current?.focus()");
    expect(modalSource).toContain('event.key === "Escape"');
    expect(modalSource).toContain('document.addEventListener("keydown", handleKeyDown)');
    expect(modalSource).toContain('document.removeEventListener("keydown", handleKeyDown)');
    expect(modalSource).toContain("useState(false)");
    expect(modalSource).toContain("row.outcomeStatus ?? null");
    expect(modalSource).toContain("const canChooseOutcome = checklistComplete");
    expect(modalSource).toContain("const canSubmit = canChooseOutcome && outcomeStatus !== null && !submitting");
    expect(modalSource).toContain("disabled={!canChooseOutcome}");
    expect(modalSource).toContain("const started = await ensureReviewStarted()");
    expect(modalSource).toContain("disabled={!canSubmit}");
    expect(modalSource).toContain("LabsSelect");
    expect(modalSource).toContain("approvalReasonOptions");
    expect(modalSource).toContain("Policy criteria met");
    expect(modalSource).toContain("Medical necessity supported");
    expect(modalSource).toContain("Prior therapy confirmed");
    expect(modalSource).toContain("approvalReasonCode: outcomeStatus === \"approved\" ? approvalReasonCode : null");
    expect(modalSource).toContain('<LabsBadge className="delegate-guidance" id={outcomeGuidanceId} variant="warning">');
    expect(modalSource).not.toContain("<select");

    const stylesSource = readFileSync(path.join(process.cwd(), "src/apps/web/app/styles.css"), "utf8");
    expect(stylesSource).toContain(".delegate-field > span");
    expect(stylesSource).not.toContain(".delegate-field span");
    expect(stylesSource).toMatch(/\.delegate-review-modal\s*\{[^}]*overflow:\s*visible;/s);
    expect(stylesSource).toMatch(/\.delegate-guidance\s*\{[^}]*font-size:\s*14px;/s);
  });

  it("renders review modal with shared checklist, radio, and dropdown primitives", () => {
    const markup = renderToStaticMarkup(
      createElement(DelegateReviewModal, {
        requestApiBase: "/api/delegate-um/requests/",
        row: buildDelegateRow("in_clinical_review", "approved"),
        onClose: () => undefined,
        onCompleted: () => undefined
      })
    );

    expect(markup).toContain("Medical necessity reviewed");
    expect(markup).toContain("Policy criteria checked");
    expect(markup).toContain("Rationale captured");
    expect(markup).toContain("Outcome status");
    expect(markup).toContain("labs-select");
    expect(markup).toContain("Approval reason");
    expect(markup).toContain("Policy criteria met");
    expect(markup).not.toContain("Denial reason");
    expect(markup).not.toContain("Not medically necessary");
    expect(markup).toContain("Submit determination");
    expect(markup).toMatch(/<button class="primary-button" disabled="" type="button">Submit determination<\/button>/);
    expect(markup).not.toContain("<select");
  });

  it("locks outcome selection until clinical checklist is complete", () => {
    const markup = renderToStaticMarkup(
      createElement(DelegateReviewModal, {
        requestApiBase: "/api/delegate-um/requests/",
        row: buildDelegateRow("in_clinical_review"),
        onClose: () => undefined,
        onCompleted: () => undefined
      })
    );

    expect(markup).toContain("Complete the clinical checklist before choosing an outcome");
    expect(markup).toContain('class="op-badge op-badge-warning delegate-guidance"');
    expect(markup).toContain('aria-describedby="delegate-outcome-guidance"');
    expect(markup).toContain('id="delegate-outcome-guidance"');
    expect(markup).toMatch(/<input[^>]*(disabled=""[^>]*value="approved"|value="approved"[^>]*disabled="")[^>]*\/>Approve/);
    expect(markup).toMatch(/<input[^>]*(disabled=""[^>]*value="denied"|value="denied"[^>]*disabled="")[^>]*\/>Deny/);
    expect(markup).not.toContain("Approval reason");
    expect(markup).not.toContain("Denial reason");
  });

  it("unlocks outcome selection after all checklist items are checked", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    let root: Root | null = createRoot(container);

    try {
      await act(async () => {
        root?.render(
          createElement(DelegateReviewModal, {
            requestApiBase: "/api/delegate-um/requests/",
            row: buildDelegateRow("in_clinical_review"),
            onClose: () => undefined,
            onCompleted: () => undefined
          })
        );
      });

      const checklistInputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
      const outcomeInputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[name="delegate-outcome"]'));

      expect(checklistInputs).toHaveLength(3);
      expect(outcomeInputs).toHaveLength(2);
      expect(outcomeInputs.every((input) => input.disabled)).toBe(true);
      expect(container.textContent).toContain("Complete the clinical checklist before choosing an outcome");

      for (const input of checklistInputs) {
        await act(async () => {
          input.click();
        });
      }

      expect(outcomeInputs.every((input) => input.disabled)).toBe(false);
      expect(container.textContent).not.toContain("Complete the clinical checklist before choosing an outcome.");

      await act(async () => {
        outcomeInputs[0]?.click();
      });

      expect(container.textContent).toContain("Approval reason");
      expect(container.textContent).toContain("Policy criteria met");
    } finally {
      await act(async () => {
        root?.unmount();
      });
      root = null;
      container.remove();
    }
  });

  it("unlocks outcome selection from a pended row after all checklist items are checked", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    let root: Root | null = createRoot(container);

    try {
      await act(async () => {
        root?.render(
          createElement(DelegateReviewModal, {
            requestApiBase: "/api/delegate-um/requests/",
            row: buildDelegateRow("pend"),
            onClose: () => undefined,
            onCompleted: () => undefined
          })
        );
      });

      const checklistInputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
      const outcomeInputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[name="delegate-outcome"]'));

      expect(container.textContent).toContain("Complete the clinical checklist before choosing an outcome");
      expect(outcomeInputs.every((input) => input.disabled)).toBe(true);

      for (const input of checklistInputs) {
        await act(async () => {
          input.click();
        });
      }

      expect(container.textContent).not.toContain("Complete the clinical checklist before choosing an outcome");
      expect(outcomeInputs.every((input) => input.disabled)).toBe(false);
    } finally {
      await act(async () => {
        root?.unmount();
      });
      root = null;
      container.remove();
    }
  });

  it("starts review before submitting a pended row determination", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const onCompleted = vi.fn();
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);

      if (target.includes("/start-review")) {
        return new Response(JSON.stringify({ state: "in_clinical_review" }), { status: 200 });
      }

      if (target.includes("/determination")) {
        return new Response(JSON.stringify(buildDelegateRow("determined", "approved")), { status: 200 });
      }

      return new Response(JSON.stringify({ error: "unexpected" }), { status: 404 });
    });
    let root: Root | null = createRoot(container);

    vi.stubGlobal("fetch", fetchMock);
    try {
      await act(async () => {
        root?.render(
          createElement(DelegateReviewModal, {
            requestApiBase: "/api/delegate-um/requests/",
            row: buildDelegateRow("pend"),
            onClose: () => undefined,
            onCompleted
          })
        );
      });

      for (const input of Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))) {
        await act(async () => {
          input.click();
        });
      }

      await act(async () => {
        container.querySelector<HTMLInputElement>('input[value="approved"]')?.click();
      });
      await act(async () => {
        Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
          .find((button) => button.textContent === "Submit determination")
          ?.click();
      });

      expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
        "/api/delegate-um/requests/PA-260526-0900-REVIEW1/start-review",
        "/api/delegate-um/requests/PA-260526-0900-REVIEW1/determination"
      ]);
      expect(onCompleted).toHaveBeenCalledWith(expect.objectContaining({ state: "determined", outcomeStatus: "approved" }));
    } finally {
      vi.unstubAllGlobals();
      await act(async () => {
        root?.unmount();
      });
      root = null;
      container.remove();
    }
  });

  it("renders denial reasons when the denial outcome is selected", () => {
    const markup = renderToStaticMarkup(
      createElement(DelegateReviewModal, {
        requestApiBase: "/api/delegate-um/requests/",
        row: buildDelegateRow("in_clinical_review", "denied"),
        onClose: () => undefined,
        onCompleted: () => undefined
      })
    );

    expect(markup).toContain("Denial reason");
    expect(markup).toContain("Not medically necessary");
    expect(markup).not.toContain("Approval reason");
    expect(markup).toContain("Submit determination");
    expect(markup).not.toContain("<select");
  });
});

function buildDelegateRow(
  state: DelegateUmRow["state"] = "pend",
  outcomeStatus: DelegateUmRow["outcomeStatus"] = null
): DelegateUmRow {
  return {
    evaluationType: "delegate_um_sla_bonus",
    umRequestId: "PA-260526-0900-REVIEW1",
    id: "PA-260526-0900-REVIEW1",
    planId: "acme-health-ppo",
    planDisplay: "Acme Health PPO",
    delegateVendorId: "northstar-um",
    requestType: "pharmacy_benefit",
    serviceLabel: "Wegovy (semaglutide) injection",
    submittedAt: "2026-05-26T09:00:00.000Z",
    pendStartedAt: "2026-05-26T09:00:00.000Z",
    slaDeadlineAt: "2026-05-27T09:00:00.000Z",
    determinedAt: null,
    timeRemainingMs: 86_400_000,
    state,
    outcomeStatus,
    slaStatus: "pending",
    incentiveStatus: "pending",
    paymentStatus: "pending",
    incentiveValue: 0,
    currency: "HBAR",
    settlementToken: { symbol: "HBAR" },
    reason: "Pending determination",
    reasonCodes: [],
    policyId: null,
    audit: null,
    walletId: null,
    paymentIntentId: null,
    transactionId: null
  };
}
