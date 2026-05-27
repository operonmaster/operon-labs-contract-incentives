import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
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
    expect(modalSource).toContain("const canSubmit = reviewStarted && checklistComplete && !submitting");
    expect(modalSource).toContain("disabled={!canSubmit}");
  });

  it("renders review modal with determination disabled before review and checklist completion", () => {
    const markup = renderToStaticMarkup(
      createElement(DelegateReviewModal, {
        requestApiBase: "/api/delegate-um/requests/",
        row: buildDelegateRow(),
        onClose: () => undefined,
        onCompleted: () => undefined
      })
    );

    expect(markup).toContain("Start review");
    expect(markup).toContain("Medical necessity reviewed");
    expect(markup).toContain("Policy criteria checked");
    expect(markup).toContain("Rationale captured");
    expect(markup).toContain("Submit determination");
    expect(markup).toMatch(/<button class="primary-button" disabled="" type="button">Submit determination<\/button>/);
  });
});

function buildDelegateRow(): DelegateUmRow {
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
    state: "pend",
    outcomeStatus: null,
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
