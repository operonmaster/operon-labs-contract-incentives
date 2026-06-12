// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, vi } from "vitest";
import { AppealsConsole } from "./AppealsConsole";
import { AppealsWorkflowModal } from "./AppealsWorkflowModal";
import type { AppealCase } from "../../lib/appeals-store";
import type { AppealsPriorAuthRow } from "../../lib/appeals-workflow";

let root: Root | null = null;

afterEach(async () => {
  vi.unstubAllGlobals();
  if (root) {
    await act(async () => {
      root?.unmount();
    });
    root = null;
  }
  document.body.innerHTML = "";
});

describe("AppealsConsole", () => {
  it("loads appeal prior-auth rows through the shared worklist hook", () => {
    const source = readFileSync(path.join(process.cwd(), "src/apps/web/components/appeals/AppealsConsole.tsx"), "utf8");

    expect(source).toContain('endpoint: "/api/appeals/prior-auths"');
    expect(source).toContain("getRowId: (row) => row.umRequestId");
    expect(source).toContain("Start appeal");
    expect(source).toContain("Open appeal");
  });

  it("renders the provider appeal workflow steps", () => {
    const markup = renderToStaticMarkup(
      createElement(AppealsWorkflowModal, {
        appealCase: buildAppealCase(),
        onClose: () => undefined,
        onUpdated: () => undefined
      })
    );

    expect(markup).toContain("Acknowledge Receipt");
    expect(markup).toContain("Validate Intake");
    expect(markup).not.toContain("Retrieve Original PA Decision");
    expect(markup).toContain("Resolve Missing Info");
    expect(markup).toContain("Assemble Packet");
    expect(markup).toContain("Index Evidence");
    expect(markup).toContain("Submit Appeal Package");
    expect(markup).not.toContain("Route Reviewer");
    expect(markup).not.toContain("Reviewer queue selected");
    expect(markup).not.toContain("Reviewer conflict check complete");
  });

  it("closes an opened existing appeal without reopening from row selection", async () => {
    const row = buildPriorAuthRow({ appealCase: buildAppealCase() });
    stubAppealsFetch([row]);
    const container = await renderAppealsConsole();

    await waitForText(container, "Open appeal");
    await act(async () => {
      findButton(container, "Open appeal").click();
    });

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Acknowledge Receipt");

    await act(async () => {
      findButton(document.body, "Close").click();
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("shows linked PA member, request, and denial context in the appeal workflow", async () => {
    const row = buildPriorAuthRow({
      appealCase: buildAppealCase(),
      billingCode: "J3490",
      denialReasonCode: "PLAN_CRITERIA_NOT_MET",
      patientDisplay: "Maya Chen"
    });
    stubAppealsFetch([row]);
    const container = await renderAppealsConsole();

    await waitForText(container, "Open appeal");
    await act(async () => {
      findButton(container, "Open appeal").click();
    });

    const dialogText = document.querySelector('[role="dialog"]')?.textContent ?? "";
    expect(dialogText).toContain("Member");
    expect(dialogText).toContain("Maya Chen");
    expect(dialogText).toContain("Provider");
    expect(dialogText).toContain("Lakeside Provider Admin");
    expect(dialogText).toContain("Denial reason");
    expect(dialogText).toContain("Plan Criteria Not Met");
    expect(dialogText).not.toContain("Billing code");
    expect(dialogText).not.toContain("PA submitted");
    expect(dialogText).not.toContain("PA determined");
    expect(dialogText).not.toContain("Appeal received");
    expect(dialogText).not.toContain("Acknowledgement SLA");
    expect(dialogText).not.toContain("Packet-readiness SLA");
    expect(document.querySelector('[role="dialog"] .appeals-denial-reason-badge')?.textContent).toBe(
      "Plan Criteria Not Met"
    );
  });

  it("starts an appeal, updates the row, and can close and reopen the workflow", async () => {
    const startedAppeal = buildAppealCase();
    const fetchMock = stubAppealsFetch([buildPriorAuthRow({ appealCase: null, canStartAppeal: true })], {
      "/api/appeals/cases": startedAppeal
    });
    const container = await renderAppealsConsole();

    await waitForText(container, "Start appeal");
    await act(async () => {
      findButton(container, "Start appeal").click();
    });

    await waitForText(document.body, startedAppeal.id);
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      umRequestId: startedAppeal.umRequestId,
      expedited: false
    });

    await act(async () => {
      findButton(document.body, "Close").click();
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(container.textContent).toContain("Open appeal");

    await act(async () => {
      findButton(container, "Open appeal").click();
    });

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(startedAppeal.id);
  });

  it("lets operators inspect completed appeal workflow steps and return to the current step", async () => {
    const appealCase = buildAppealCase({
      state: "intake_validated",
      acknowledgedAt: "2026-06-18T16:30:00.000Z",
      intake: {
        appealRequestPresent: true,
        appellantAuthorized: true,
        planMemberMatched: true,
        requestedServiceMatched: true
      }
    });
    stubAppealsFetch([buildPriorAuthRow({ appealCase })]);
    const container = await renderAppealsConsole();

    await waitForText(container, "Open appeal");
    await act(async () => {
      findButton(container, "Open appeal").click();
    });

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Resolve Missing Info");
    expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain("Retrieve Original PA Decision");
    expect(findButton(document.body, "Resolve missing info").disabled).toBe(true);

    await act(async () => {
      findButtonByLabel(document.body, "Validate Intake").click();
    });

    const reviewedText = document.querySelector('[role="dialog"]')?.textContent ?? "";
    expect(reviewedText).toContain("Validate Intake");
    expect(reviewedText).toContain("Appeal request present");
    expect(reviewedText).toContain("Appellant authorized");
    expect(reviewedText).toContain("Completed step");
    expect(Array.from(document.querySelectorAll("button")).some((button) => button.textContent === "Validate intake")).toBe(
      false
    );

    await act(async () => {
      findButtonByLabel(document.body, "Resolve Missing Info").click();
    });

    expect(findButton(document.body, "Resolve missing info").disabled).toBe(true);
  });

  it("requires intake assertions before posting the selected evidence values", async () => {
    const activeIntake = buildAppealCase({
      state: "acknowledged",
      acknowledgedAt: "2026-06-18T16:30:00.000Z"
    });
    const updated = buildAppealCase({
      state: "intake_validated",
      acknowledgedAt: activeIntake.acknowledgedAt,
      intake: {
        appealRequestPresent: true,
        appellantAuthorized: true,
        planMemberMatched: true,
        requestedServiceMatched: true
      }
    });
    const fetchMock = stubAppealsFetch([buildPriorAuthRow({ appealCase: activeIntake })], {
      [`/api/appeals/cases/${encodeURIComponent(activeIntake.id)}/intake`]: updated
    });
    const container = await renderAppealsConsole();

    await waitForText(container, "Open appeal");
    await act(async () => {
      findButton(container, "Open appeal").click();
    });

    expect(findButton(document.body, "Validate intake").disabled).toBe(true);

    for (const label of [
      "Appeal request present",
      "Appellant authorized",
      "Member match confirmed",
      "Requested service match confirmed"
    ]) {
      await act(async () => {
        findCheckboxByLabel(document.body, label).click();
      });
    }

    expect(findButton(document.body, "Validate intake").disabled).toBe(false);
    await act(async () => {
      findButton(document.body, "Validate intake").click();
    });

    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      appealRequestPresent: true,
      appellantAuthorized: true,
      planMemberMatched: true,
      requestedServiceMatched: true
    });
    await waitForText(document.body, "Resolve Missing Info");
  });

  it("indexes appeal evidence without exposing PHI metadata as an operator assertion", async () => {
    const activeIndex = buildAppealCase({
      state: "packet_assembled",
      packet: {
        requiredDocumentsPresent: true,
        clinicalRationaleIncluded: true,
        policyCitationIncluded: true,
        evidenceIndexComplete: false,
        qualityAuditPassed: true,
        noReworkRequired: true
      }
    });
    const updated = buildAppealCase({
      state: "evidence_indexed",
      packet: {
        ...activeIndex.packet,
        evidenceIndexComplete: true
      }
    });
    const fetchMock = stubAppealsFetch([buildPriorAuthRow({ appealCase: activeIndex })], {
      [`/api/appeals/cases/${encodeURIComponent(activeIndex.id)}/evidence-index`]: updated
    });
    const container = await renderAppealsConsole();

    await waitForText(container, "Open appeal");
    await act(async () => {
      findButton(container, "Open appeal").click();
    });

    const dialogText = document.querySelector('[role="dialog"]')?.textContent ?? "";
    expect(dialogText).toContain("Evidence index complete");
    expect(dialogText).not.toContain("Payment metadata excludes PHI");
    expect(findButton(document.body, "Index evidence").disabled).toBe(true);

    await act(async () => {
      findCheckboxByLabel(document.body, "Evidence index complete").click();
    });

    expect(findButton(document.body, "Index evidence").disabled).toBe(false);
    await act(async () => {
      findButton(document.body, "Index evidence").click();
    });

    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      evidenceIndexComplete: true,
      phiSafeForPaymentMetadata: true
    });

    await waitForText(document.body, "Submit Appeal Package");
    await act(async () => {
      findButtonByLabel(document.body, "Index Evidence").click();
    });

    const completedStepText = document.querySelector('[role="dialog"]')?.textContent ?? "";
    expect(completedStepText).toContain("Evidence index complete");
    expect(completedStepText).not.toContain("Payment metadata excludes PHI");
  });

  it("only exposes the Start appeal action for denied prior authorizations", async () => {
    stubAppealsFetch([
      buildPriorAuthRow({ appealCase: null, canStartAppeal: true }),
      buildPriorAuthRow({
        appealCase: null,
        umRequestId: "PA-260526-0900-APPROVED",
        outcomeStatus: "approved",
        eligibilityStatus: "not_appeal_eligible"
      }),
      buildPriorAuthRow({
        appealCase: null,
        umRequestId: "PA-260526-0900-PENDING",
        state: "pend",
        outcomeStatus: null,
        eligibilityStatus: "awaiting_determination"
      })
    ]);
    const container = await renderAppealsConsole();

    await waitForText(container, "3 prior authorizations loaded");

    const startAppealButtons = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).filter(
      (button) => button.textContent === "Start appeal"
    );
    expect(startAppealButtons).toHaveLength(1);
    expect(startAppealButtons[0]?.disabled).toBe(false);
  });

  it("renders the appeals worklist without duplicate prior authorization state columns", async () => {
    stubAppealsFetch([buildPriorAuthRow({ appealCase: null, canStartAppeal: true })]);
    const container = await renderAppealsConsole();

    await waitForText(container, "1 prior authorization loaded");

    const headers = Array.from(container.querySelectorAll<HTMLTableCellElement>("thead th")).map(
      (header) => header.textContent
    );
    const firstRowCells = container.querySelectorAll<HTMLTableCellElement>("tbody tr:not(.loading-row):first-child td");

    expect(headers).toEqual(["PA ID", "Plan", "Request type", "Drug/service", "Appeal status", "Action"]);
    expect(headers).not.toContain("PA state");
    expect(headers).not.toContain("PA outcome");
    expect(firstRowCells).toHaveLength(6);
  });

  it("keeps terminal packet-ready summary open with a health plan handoff link", async () => {
    const inReview = buildAppealCase({ state: "evidence_indexed" });
    const packetReady = buildAppealCase({
      state: "packet_ready",
      packetReadyAt: "2026-06-19T15:00:00.000Z"
    });
    stubAppealsFetch([buildPriorAuthRow({ appealCase: inReview })], {
      [`/api/appeals/cases/${encodeURIComponent(inReview.id)}/route-reviewer`]: packetReady
    });
    const container = await renderAppealsConsole();

    await waitForText(container, "Open appeal");
    await act(async () => {
      findButton(container, "Open appeal").click();
    });
    const dialogText = document.querySelector('[role="dialog"]')?.textContent ?? "";
    expect(dialogText).toContain("Submit Appeal Package");
    expect(dialogText).toContain("Appeal packet complete");
    expect(dialogText).toContain("Submission confirmation captured");
    expect(dialogText).not.toContain("Route Reviewer");
    expect(dialogText).not.toContain("Reviewer queue selected");
    expect(dialogText).not.toContain("Reviewer conflict check complete");

    for (const label of ["Appeal packet complete", "Submission confirmation captured"]) {
      await act(async () => {
        findCheckboxByLabel(document.body, label).click();
      });
    }
    await act(async () => {
      findButton(document.body, "Submit package").click();
    });

    await waitForText(document.body, "Appeal packet ready");
    const handoff = Array.from(document.querySelectorAll<HTMLAnchorElement>("a")).find(
      (link) => link.textContent === "Health Plan View"
    );

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(handoff?.getAttribute("href")).toBe(`/appeals/plan?appealId=${encodeURIComponent(packetReady.id)}`);
  });

  it("keeps the appeals stepper responsive after the global mobile stepper rule", () => {
    const source = readFileSync(path.join(process.cwd(), "src/apps/web/app/styles.css"), "utf8");

    expect(source).toMatch(/@media\s*\(max-width:\s*720px\)[\s\S]*\.appeals-stepper[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(120px,\s*1fr\)\)/);
  });
});

function buildAppealCase(overrides: Partial<AppealCase> = {}): AppealCase {
  return {
    id: "APL-260526-0900-DENIED01",
    umRequestId: "PA-260526-0900-DENIED01",
    source: "provider_started_from_denied_pa",
    planId: "acme-health-ppo",
    providerId: "lakeside-provider-admin",
    submitterId: "lakeside-provider-admin",
    requestType: "pharmacy_benefit",
    serviceCode: "humira_adalimumab",
    serviceLabel: "Humira (adalimumab)",
    originalOutcomeStatus: "denied",
    originalDenialReasonCode: "PLAN_CRITERIA_NOT_MET",
    state: "created",
    appealReceivedAt: "2026-06-18T16:00:00.000Z",
    acknowledgedAt: null,
    packetReadyAt: null,
    packetReadinessSlaHours: 24,
    acknowledgementSlaBusinessHours: 2,
    expedited: false,
    intake: { appealRequestPresent: false, appellantAuthorized: false, planMemberMatched: false, requestedServiceMatched: false },
    originalDecision: { denialReasonRetrieved: false, priorDecisionSummaryIncluded: false, coveragePolicyLocated: false },
    missingInfo: { missingInfoRequired: false, missingInfoRequested: false, missingInfoResolved: false },
    packet: { requiredDocumentsPresent: false, clinicalRationaleIncluded: false, policyCitationIncluded: false, evidenceIndexComplete: false, qualityAuditPassed: false, noReworkRequired: false },
    routing: { reviewerQueueSelected: false, reviewerConflictCheckComplete: false, finalDecisionOutsideIncentive: true },
    updatedAt: "2026-06-18T16:00:00.000Z",
    ...overrides
  };
}

function buildPriorAuthRow({
  appealCase,
  canStartAppeal = false,
  eligibilityStatus,
  billingCode = "J3490",
  denialReasonCode = "PLAN_CRITERIA_NOT_MET",
  outcomeStatus = "denied",
  patientDisplay = "Maya Chen",
  state = "determined",
  umRequestId = "PA-260526-0900-DENIED01"
}: {
  appealCase: AppealCase | null;
  canStartAppeal?: boolean;
  eligibilityStatus?: AppealsPriorAuthRow["eligibilityStatus"];
  billingCode?: string;
  denialReasonCode?: string | null;
  outcomeStatus?: AppealsPriorAuthRow["outcomeStatus"];
  patientDisplay?: string;
  state?: AppealsPriorAuthRow["state"];
  umRequestId?: string;
}): AppealsPriorAuthRow {
  return {
    umRequest: {
      id: umRequestId,
      patientDisplay,
      planDisplay: "Acme Health PPO",
      providerDisplay: "Lakeside Provider Admin",
      requestType: "pharmacy_benefit",
      serviceLabel: "Humira (adalimumab)",
      serviceCode: "humira_adalimumab",
      billingCode,
      state,
      outcomeStatus,
      submittedAt: "2026-06-18T15:00:00.000Z",
      determinedAt: state === "determined" ? "2026-06-18T15:35:00.000Z" : null,
      clinicalReview: {
        denialReasonCode: outcomeStatus === "denied" ? denialReasonCode : null
      }
    } as AppealsPriorAuthRow["umRequest"],
    umRequestId,
    planDisplay: "Acme Health PPO",
    requestType: "pharmacy_benefit",
    serviceLabel: "Humira (adalimumab)",
    state,
    outcomeStatus,
    eligibilityStatus: eligibilityStatus ?? (appealCase ? "open" : "startable"),
    canStartAppeal,
    appealCase
  };
}

function stubAppealsFetch(
  rows: AppealsPriorAuthRow[],
  postResponses: Record<string, AppealCase> = {}
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: Parameters<typeof fetch>[1]) => {
    const target = String(url);

    if (target === "/api/appeals/prior-auths") {
      return new Response(JSON.stringify({ rows }), { status: 200 });
    }

    const response = postResponses[target];
    if (init?.method === "POST" && response) {
      return new Response(JSON.stringify(response), { status: 200 });
    }

    return new Response(JSON.stringify({ error: `unexpected ${target}` }), { status: 404 });
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function renderAppealsConsole(): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(createElement(AppealsConsole));
  });

  return container;
}

async function waitForText(container: HTMLElement, text: string): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (container.textContent?.includes(text)) {
      return;
    }

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
  }

  throw new Error(`Text not found: ${text}`);
}

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (candidate) => candidate.textContent === text
  );

  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  return button;
}

function findButtonByLabel(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (candidate) => candidate.getAttribute("aria-label") === label
  );

  if (!button) {
    throw new Error(`Button not found by label: ${label}`);
  }

  return button;
}

function findCheckboxByLabel(container: HTMLElement, label: string): HTMLInputElement {
  const labelElement = Array.from(container.querySelectorAll<HTMLLabelElement>("label")).find((candidate) =>
    candidate.textContent?.includes(label)
  );
  const checkbox = labelElement?.querySelector<HTMLInputElement>('input[type="checkbox"]');

  if (!checkbox) {
    throw new Error(`Checkbox not found by label: ${label}`);
  }

  return checkbox;
}
