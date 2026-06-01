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
    expect(markup).toContain("Retrieve Original PA Decision");
    expect(markup).toContain("Resolve Missing Info");
    expect(markup).toContain("Assemble Packet");
    expect(markup).toContain("Index Evidence");
    expect(markup).toContain("Route Reviewer");
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
    await act(async () => {
      findButton(document.body, "Route reviewer").click();
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
    missingInfo: { missingInfoRequired: false, missingInfoRequested: false, missingInfoResolved: true },
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
  outcomeStatus = "denied",
  state = "determined",
  umRequestId = "PA-260526-0900-DENIED01"
}: {
  appealCase: AppealCase | null;
  canStartAppeal?: boolean;
  eligibilityStatus?: AppealsPriorAuthRow["eligibilityStatus"];
  outcomeStatus?: AppealsPriorAuthRow["outcomeStatus"];
  state?: AppealsPriorAuthRow["state"];
  umRequestId?: string;
}): AppealsPriorAuthRow {
  return {
    umRequest: {
      id: umRequestId,
      requestType: "pharmacy_benefit",
      state,
      outcomeStatus,
      submittedAt: "2026-06-18T15:00:00.000Z"
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
