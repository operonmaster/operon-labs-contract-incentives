import type { SpecialtyFulfillmentCase } from "../../lib/specialty-rx-store";
import type { SpecialtyRxPlanAuditRow } from "../../lib/specialty-rx-workflow";

export function formatFulfillmentState(state: SpecialtyFulfillmentCase["state"]): string {
  switch (state) {
    case "intake_triage":
      return "Intake & Triage";
    case "clear_to_fill":
      return "Clear To Fill";
    case "shipment_scheduled":
      return "Shipment Scheduled";
    case "fulfilled":
      return "Fulfilled";
    case "exception":
      return "Exception";
  }
}

export function formatSlaStatus(status: SpecialtyRxPlanAuditRow["scheduleSlaStatus"]): string {
  switch (status) {
    case "within_sla":
      return "Within SLA";
    case "breached":
      return "Breached";
    case "not_applicable":
      return "Not applicable";
    case "pending":
      return "Pending";
  }
}

export function specialtySlaBadgeVariant(
  status: SpecialtyRxPlanAuditRow["scheduleSlaStatus"]
): "info" | "success" | "warning" | "neutral" {
  if (status === "within_sla") {
    return "success";
  }

  if (status === "breached") {
    return "warning";
  }

  if (status === "not_applicable") {
    return "neutral";
  }

  return "info";
}

export function fulfillmentStateBadgeVariant(state: SpecialtyFulfillmentCase["state"]): "info" | "success" | "warning" | "neutral" {
  if (state === "fulfilled") {
    return "success";
  }

  if (state === "exception") {
    return "warning";
  }

  if (state === "intake_triage") {
    return "neutral";
  }

  return "info";
}

export function formatNullableDateTime(value: string | null): string {
  if (!value) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}
