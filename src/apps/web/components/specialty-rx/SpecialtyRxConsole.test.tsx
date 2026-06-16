// @vitest-environment happy-dom

import { act, createElement } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SpecialtyFulfillmentCase } from "../../lib/specialty-rx-store";
import { formatNullableDateTime } from "./specialty-rx-formatters";
import { SpecialtyRxWorkflowModal } from "./SpecialtyRxWorkflowModal";

let root: Root | null = null;

describe("SpecialtyRxWorkflowModal", () => {
  afterEach(async () => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    document.body.innerHTML = "";
  });

  it("renders the fulfillment workflow steps", () => {
    const markup = renderToStaticMarkup(
      createElement(SpecialtyRxWorkflowModal, {
        caseRecord: buildSpecialtyFulfillmentCase(),
        onClose: () => undefined,
        onUpdated: () => undefined
      })
    );

    expect(markup).toContain("Intake &amp; Triage");
    expect(markup).toContain("Clear To Fill");
    expect(markup).toContain("Schedule Shipment");
    expect(markup).toContain("Confirm Fulfillment");
    expect(markup).toContain("Fulfillment SLA");
    expect(markup).toContain("Not started");
  });

  it("shows a closed Fulfillment SLA on the confirmation step after shipment is scheduled", () => {
    const markup = renderToStaticMarkup(
      createElement(SpecialtyRxWorkflowModal, {
        caseRecord: {
          ...buildSpecialtyFulfillmentCase(),
          state: "shipment_scheduled",
          fulfillmentSlaStartedAt: "2026-05-28T15:00:00.000Z",
          clearToFillAt: "2026-05-28T15:00:00.000Z",
          shipmentScheduledAt: "2026-05-28T16:00:00.000Z"
        },
        onClose: () => undefined,
        onUpdated: () => undefined
      })
    );

    expect(markup).toContain("Fulfillment SLA");
    expect(markup).toContain("Closed - Within SLA");
  });

  it("renders Schedule Shipment as the state badge before shipment is scheduled", () => {
    const markup = renderToStaticMarkup(
      createElement(SpecialtyRxWorkflowModal, {
        caseRecord: {
          ...buildSpecialtyFulfillmentCase(),
          state: "shipment_scheduled",
          fulfillmentSlaStartedAt: "2026-05-28T15:00:00.000Z",
          clearToFillAt: "2026-05-28T15:00:00.000Z",
          shipmentScheduledAt: null
        },
        onClose: () => undefined,
        onUpdated: () => undefined
      })
    );

    expect(getWorkflowStateBadgeText(markup)).toBe("Schedule Shipment");
    expect(markup).not.toContain(">Shipment Scheduled<");
  });

  it("renders Shipment Scheduled as the state badge after shipment is scheduled", () => {
    const markup = renderToStaticMarkup(
      createElement(SpecialtyRxWorkflowModal, {
        caseRecord: {
          ...buildSpecialtyFulfillmentCase(),
          state: "shipment_scheduled",
          fulfillmentSlaStartedAt: "2026-05-28T15:00:00.000Z",
          clearToFillAt: "2026-05-28T15:00:00.000Z",
          shipmentScheduledAt: "2026-05-28T16:00:00.000Z"
        },
        onClose: () => undefined,
        onUpdated: () => undefined
      })
    );

    expect(getWorkflowStateBadgeText(markup)).toBe("Shipment Scheduled");
  });

  it("shows active Fulfillment SLA time remaining during clear to fill and shipment scheduling", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T16:00:00.000Z"));

    const clearToFillMarkup = renderToStaticMarkup(
      createElement(SpecialtyRxWorkflowModal, {
        caseRecord: {
          ...buildSpecialtyFulfillmentCase(),
          state: "clear_to_fill",
          fulfillmentSlaStartedAt: "2026-05-28T15:00:00.000Z",
          clearToFillAt: null
        },
        onClose: () => undefined,
        onUpdated: () => undefined
      })
    );
    const scheduleShipmentMarkup = renderToStaticMarkup(
      createElement(SpecialtyRxWorkflowModal, {
        caseRecord: {
          ...buildSpecialtyFulfillmentCase(),
          state: "shipment_scheduled",
          fulfillmentSlaStartedAt: "2026-05-28T15:00:00.000Z",
          clearToFillAt: "2026-05-28T15:00:00.000Z"
        },
        onClose: () => undefined,
        onUpdated: () => undefined
      })
    );

    expect(clearToFillMarkup).toContain("Fulfillment SLA");
    expect(clearToFillMarkup).toContain("23h remaining");
    expect(scheduleShipmentMarkup).toContain("Fulfillment SLA");
    expect(scheduleShipmentMarkup).toContain("23h remaining");
  });

  it("shows breached Fulfillment SLA time while shipment scheduling is still open", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-29T16:30:00.000Z"));

    const markup = renderToStaticMarkup(
      createElement(SpecialtyRxWorkflowModal, {
        caseRecord: {
          ...buildSpecialtyFulfillmentCase(),
          state: "shipment_scheduled",
          fulfillmentSlaStartedAt: "2026-05-28T15:00:00.000Z",
          clearToFillAt: "2026-05-28T15:00:00.000Z"
        },
        onClose: () => undefined,
        onUpdated: () => undefined
      })
    );

    expect(markup).toContain("Fulfillment SLA");
    expect(markup).toContain("Breached by 1h 30m");
  });

  it("uses Fulfillment SLA as the workqueue clock column", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/apps/web/components/specialty-rx/SpecialtyRxConsole.tsx"),
      "utf8"
    );

    expect(source).toContain("Fulfillment SLA");
    expect(source).not.toContain("<th>Clear to fill</th>");
    expect(source).not.toContain("<th>Shipment</th>");
  });

  it("keeps the pharmacy workqueue table compact by omitting the linked PA column", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/apps/web/components/specialty-rx/SpecialtyRxConsole.tsx"),
      "utf8"
    );

    expect(source).not.toContain("<th>Linked PA</th>");
    expect(source).not.toContain('<td className="mono-cell">{row.umRequestId}</td>');
    expect(source).toContain("colSpan={6}");
    expect(source).not.toContain("colSpan={7}");
  });

  it("marks the active workflow step for assistive technology", () => {
    const markup = renderToStaticMarkup(
      createElement(SpecialtyRxWorkflowModal, {
        caseRecord: buildSpecialtyFulfillmentCase(),
        onClose: () => undefined,
        onUpdated: () => undefined
      })
    );

    expect(markup).toContain('aria-label="Specialty fulfillment workflow steps"');
    expect(markup.match(/aria-current="step"/g)).toHaveLength(1);
    const root = document.createElement("div");
    root.innerHTML = markup;
    expect(root.querySelector('li[aria-current="step"]')?.classList.contains("active")).toBe(true);
  });

  it("renders the active operator checklist inside the shared workflow checklist layout", () => {
    const markup = renderToStaticMarkup(
      createElement(SpecialtyRxWorkflowModal, {
        caseRecord: buildSpecialtyFulfillmentCase(),
        onClose: () => undefined,
        onUpdated: () => undefined
      })
    );

    expect(markup).toContain('class="workflow-checklist"');
    expect(markup).toMatch(/class="workflow-checklist"[\s\S]*Prescription present/);
    expect(markup).toMatch(/class="workflow-checklist"[\s\S]*Handoff packet\/data complete/);
  });

  it.each([
    {
      caseRecord: buildSpecialtyFulfillmentCase(),
      cta: "Complete intake",
      expectedPath: "/api/specialty-rx/cases/RXF-260528-0900-SPECIAL1/intake",
      labels: [
        "Prescription present",
        "Assigned pharmacy confirmed",
        "Therapy metadata present",
        "Handoff packet/data complete"
      ],
      expectedPayload: {
        prescriptionPresent: true,
        assignedPharmacyConfirmed: true,
        therapyMetadataPresent: true,
        handoffDataComplete: true
      }
    },
    {
      caseRecord: {
        ...buildSpecialtyFulfillmentCase(),
        state: "clear_to_fill",
        fulfillmentSlaStartedAt: "2026-05-28T15:00:00.000Z"
      } satisfies SpecialtyFulfillmentCase,
      cta: "Mark clear to fill",
      expectedPath: "/api/specialty-rx/cases/RXF-260528-0900-SPECIAL1/clear-to-fill",
      labels: [
        "Benefits/claim check completed",
        "Prescription valid",
        "Inventory available",
        "Copay/payment ready"
      ],
      expectedPayload: {
        benefitsOrClaimCheckCompleted: true,
        prescriptionValid: true,
        prescriberClarificationRequired: false,
        prescriberClarificationResolved: true,
        remsRequired: false,
        remsAuthorizationConfirmed: true,
        inventoryAvailable: true,
        copayOrPaymentReady: true
      }
    },
    {
      caseRecord: {
        ...buildSpecialtyFulfillmentCase(),
        state: "shipment_scheduled",
        fulfillmentSlaStartedAt: "2026-05-28T15:00:00.000Z",
        clearToFillAt: "2026-05-28T15:30:00.000Z",
        shipmentScheduledAt: null
      } satisfies SpecialtyFulfillmentCase,
      cta: "Schedule shipment",
      expectedPath: "/api/specialty-rx/cases/RXF-260528-0900-SPECIAL1/shipment",
      labels: [
        "Patient contact attempt documented",
        "Address confirmed",
        "Delivery window confirmed",
        "Cold-chain packout validated",
        "Courier scheduled"
      ],
      expectedPayload: {
        patientContactAttemptDocumented: true,
        addressConfirmed: true,
        deliveryWindowConfirmed: true,
        coldChainPackoutValidated: true,
        courierScheduled: true
      }
    },
    {
      caseRecord: {
        ...buildSpecialtyFulfillmentCase(),
        state: "shipment_scheduled",
        fulfillmentSlaStartedAt: "2026-05-28T15:00:00.000Z",
        clearToFillAt: "2026-05-28T15:30:00.000Z",
        shipmentScheduledAt: "2026-05-28T16:00:00.000Z"
      } satisfies SpecialtyFulfillmentCase,
      cta: "Confirm fulfillment",
      expectedPath: "/api/specialty-rx/cases/RXF-260528-0900-SPECIAL1/fulfillment",
      labels: ["Shipped", "Delivery confirmed", "Delivery attempt documented", "Temperature log valid"],
      expectedPayload: {
        shipped: true,
        deliveryConfirmed: true,
        deliveryAttemptDocumented: true,
        temperatureLogValid: true,
        avoidableFulfillmentException: false,
        externalBlockerDocumented: false,
        exceptionReasonCode: null
      }
    }
  ])("requires every checklist item before submitting $cta", async (scenario) => {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => scenario.caseRecord
    }));
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root?.render(
        createElement(SpecialtyRxWorkflowModal, {
          caseRecord: scenario.caseRecord,
          onClose: () => undefined,
          onUpdated: () => undefined
        })
      );
    });

    const cta = findButton(document.body, scenario.cta);
    expect(cta.disabled).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();

    for (const label of scenario.labels.slice(0, -1)) {
      await act(async () => {
        findCheckboxByLabel(document.body, label).click();
      });
      expect(cta.disabled).toBe(true);
    }

    await act(async () => {
      findCheckboxByLabel(document.body, scenario.labels.at(-1) ?? "").click();
    });
    expect(cta.disabled).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(findButton(document.body, scenario.cta).disabled).toBe(false);
    expect(findCheckboxByLabel(document.body, scenario.labels.at(-1) ?? "").checked).toBe(true);

    await act(async () => {
      cta.click();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      scenario.expectedPath,
      expect.objectContaining({
        body: JSON.stringify(scenario.expectedPayload),
        method: "POST"
      })
    );
  });

  it("lets operators inspect completed fulfillment steps and resets to a newer active step", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    const scheduledCase = {
      ...buildSpecialtyFulfillmentCase(),
      state: "shipment_scheduled",
      fulfillmentSlaStartedAt: "2026-05-28T15:00:00.000Z",
      clearToFillAt: "2026-05-28T15:30:00.000Z",
      shipmentScheduledAt: null,
      intake: {
        approvedPaLinked: true,
        prescriptionPresent: true,
        assignedPharmacyConfirmed: true,
        therapyMetadataPresent: true,
        handoffDataComplete: true
      },
      clearToFill: {
        benefitsOrClaimCheckCompleted: true,
        prescriptionValid: true,
        prescriberClarificationRequired: false,
        prescriberClarificationResolved: true,
        remsRequired: true,
        remsAuthorizationConfirmed: true,
        inventoryAvailable: true,
        copayOrPaymentReady: true
      }
    } satisfies SpecialtyFulfillmentCase;

    await act(async () => {
      root?.render(
        createElement(SpecialtyRxWorkflowModal, {
          caseRecord: scheduledCase,
          onClose: () => undefined,
          onUpdated: () => undefined
        })
      );
    });

    expect(findButtonByLabel(document.body, "Confirm Fulfillment").disabled).toBe(true);
    expect(findButton(document.body, "Schedule shipment").disabled).toBe(true);

    await checkWorkflowItems([
      "Patient contact attempt documented",
      "Address confirmed",
      "Delivery window confirmed",
      "Cold-chain packout validated",
      "Courier scheduled"
    ]);
    expect(findButton(document.body, "Schedule shipment").disabled).toBe(false);

    await act(async () => {
      findButtonByLabel(document.body, "Clear To Fill").click();
    });

    const reviewedText = document.querySelector('[role="dialog"]')?.textContent ?? "";
    expect(reviewedText).toContain("Clear To Fill");
    expect(reviewedText).toContain("Benefits check");
    expect(reviewedText).toContain("Prescription valid");
    expect(reviewedText).toContain("Completed step");
    expect(Array.from(document.querySelectorAll("button")).some((button) => button.textContent === "Mark clear to fill")).toBe(
      false
    );

    await act(async () => {
      findButtonByLabel(document.body, "Schedule Shipment").click();
    });

    expect(findButton(document.body, "Schedule shipment").disabled).toBe(false);

    await act(async () => {
      root?.render(
        createElement(SpecialtyRxWorkflowModal, {
          caseRecord: {
            ...scheduledCase,
            shipmentScheduledAt: "2026-05-28T16:00:00.000Z"
          },
          onClose: () => undefined,
          onUpdated: () => undefined
        })
      );
    });

    expect(findButton(document.body, "Confirm fulfillment").disabled).toBe(true);
    expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain("Completed step");

    await checkWorkflowItems(["Shipped", "Delivery confirmed", "Delivery attempt documented", "Temperature log valid"]);
    expect(findButton(document.body, "Confirm fulfillment").disabled).toBe(false);

    await act(async () => {
      root?.render(
        createElement(SpecialtyRxWorkflowModal, {
          caseRecord: {
            ...scheduledCase,
            state: "fulfilled",
            shipmentScheduledAt: "2026-05-28T16:00:00.000Z",
            deliveryConfirmedAt: "2026-05-28T18:00:00.000Z",
            fulfillment: {
              shipped: true,
              deliveryConfirmed: true,
              deliveryAttemptDocumented: true,
              temperatureLogValid: true,
              avoidableFulfillmentException: false,
              externalBlockerDocumented: false,
              exceptionReasonCode: null
            }
          },
          onClose: () => undefined,
          onUpdated: () => undefined
        })
      );
    });

    const terminalText = document.querySelector('[role="dialog"]')?.textContent ?? "";
    expect(terminalText).toContain("Confirm Fulfillment");
    expect(terminalText).toContain("Temperature log valid");
    expect(terminalText).toContain("Completed step");
    expect(Array.from(document.querySelectorAll("button")).some((button) => button.textContent === "Confirm fulfillment")).toBe(
      false
    );
  });
});

describe("formatNullableDateTime", () => {
  it("formats null dates as pending", () => {
    expect(formatNullableDateTime(null)).toBe("Pending");
  });

  it("formats valid date strings", () => {
    const value = "2026-05-28T15:05:00.000Z";
    const expected = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      month: "short"
    }).format(new Date(value));

    expect(formatNullableDateTime(value)).toBe(expected);
  });

  it("formats malformed date strings as invalid date", () => {
    expect(formatNullableDateTime("not-a-date")).toBe("Invalid date");
  });
});

function buildSpecialtyFulfillmentCase(): SpecialtyFulfillmentCase {
  return {
    id: "RXF-260528-0900-SPECIAL1",
    umRequestId: "PA-260528-0900-SPECIAL1",
    source: "delegate_um_approved",
    planId: "acme-health",
    pharmacyId: "atlas-specialty-rx",
    pharmacyDisplay: "Atlas Specialty Rx",
    requestType: "pharmacy_benefit",
    serviceCode: "rx-dupixent",
    serviceLabel: "Dupixent 300 mg/2 mL pen",
    codingSystem: "NDC",
    billingCode: "00024-5915-02",
    state: "intake_triage",
    paApprovalReceivedAt: "2026-05-28T15:00:00.000Z",
    intakeStartedAt: "2026-05-28T15:05:00.000Z",
    fulfillmentSlaStartedAt: null,
    clearToFillAt: null,
    shipmentScheduledAt: null,
    deliveryConfirmedAt: null,
    exceptionRecordedAt: null,
    scheduleSlaHours: 24,
    intake: {
      approvedPaLinked: true,
      prescriptionPresent: false,
      assignedPharmacyConfirmed: false,
      therapyMetadataPresent: false,
      handoffDataComplete: false
    },
    clearToFill: {
      benefitsOrClaimCheckCompleted: false,
      prescriptionValid: false,
      prescriberClarificationRequired: false,
      prescriberClarificationResolved: true,
      remsRequired: false,
      remsAuthorizationConfirmed: true,
      inventoryAvailable: false,
      copayOrPaymentReady: false
    },
    shipment: {
      patientContactAttemptDocumented: false,
      addressConfirmed: false,
      deliveryWindowConfirmed: false,
      coldChainRequired: true,
      coldChainPackoutValidated: false,
      courierScheduled: false
    },
    fulfillment: {
      shipped: false,
      deliveryConfirmed: false,
      deliveryAttemptDocumented: false,
      temperatureLogValid: false,
      avoidableFulfillmentException: false,
      externalBlockerDocumented: false,
      exceptionReasonCode: null
    },
    updatedAt: "2026-05-28T15:05:00.000Z"
  };
}

function getWorkflowStateBadgeText(markup: string): string | null | undefined {
  const root = document.createElement("div");
  root.innerHTML = markup;
  return root.querySelector(".delegate-review-id-line .op-badge")?.textContent;
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
  const checkbox = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).find(
    (candidate) => candidate.closest("label")?.textContent?.trim() === label
  );

  if (!checkbox) {
    throw new Error(`Checkbox not found: ${label}`);
  }

  return checkbox;
}

async function checkWorkflowItems(labels: string[]): Promise<void> {
  for (const label of labels) {
    await act(async () => {
      findCheckboxByLabel(document.body, label).click();
    });
  }
}
