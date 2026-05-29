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

export function formatBusinessPolicyStatus(status: SpecialtyRxPlanAuditRow["businessPolicyStatus"]): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return "Pending";
  }
}

export function formatPaymentPolicyStatus(status: SpecialtyRxPlanAuditRow["paymentPolicyStatus"]): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "blocked":
      return "Blocked";
    default:
      return "Pending";
  }
}

export function formatRequestType(requestType: SpecialtyRxPlanAuditRow["requestType"]): string {
  switch (requestType) {
    case "pharmacy_benefit":
      return "Pharmacy Benefit";
  }
}

export function formatCurrency(row: Pick<SpecialtyRxPlanAuditRow, "currency" | "incentiveValue" | "settlementToken">): string {
  return `${row.incentiveValue.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })} ${row.settlementToken?.symbol ?? row.currency}`;
}

export function businessPolicyStatusBadgeVariant(
  status: SpecialtyRxPlanAuditRow["businessPolicyStatus"]
): "success" | "warning" | "neutral" {
  if (status === "approved") {
    return "success";
  }

  if (status === "rejected") {
    return "warning";
  }

  return "neutral";
}

export function paymentPolicyStatusBadgeVariant(
  status: SpecialtyRxPlanAuditRow["paymentPolicyStatus"]
): "success" | "warning" | "neutral" {
  if (status === "paid") {
    return "success";
  }

  if (status === "blocked") {
    return "warning";
  }

  return "neutral";
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
  if (value === null) {
    return "Pending";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    month: "short"
  }).format(date);
}
