import type { UMRequest } from "@operon-labs/um-platform";
import type { DelegatePlanAuditRow } from "../../lib/delegate-um-workflow";

export function formatRequestType(requestType: UMRequest["requestType"]) {
  switch (requestType) {
    case "outpatient_service":
      return "Outpatient Service";
    case "pharmacy_benefit":
      return "Pharmacy Benefit";
    case "inpatient_admission":
      return "Inpatient Admission";
    default:
      return "Unknown request type";
  }
}

export function formatUmState(state: UMRequest["state"]) {
  switch (state) {
    case "pend":
      return "Pended";
    case "in_clinical_review":
      return "In clinical review";
    case "determined":
      return "Determined";
  }
}

export function formatOutcomeStatus(outcomeStatus: UMRequest["outcomeStatus"]) {
  if (!outcomeStatus) {
    return "Pending";
  }

  return outcomeStatus === "approved" ? "Approved" : "Denied";
}

export function formatSlaStatus(row: Pick<DelegatePlanAuditRow, "slaStatus" | "timeRemainingMs">) {
  if (row.slaStatus === "within_sla") {
    return "Within SLA";
  }

  if (row.slaStatus === "breached") {
    return "SLA breached";
  }

  return `${formatDuration(row.timeRemainingMs)} remaining`;
}

export function formatUmRequestSlaStatus(request: Pick<UMRequest, "determinedAt" | "slaDeadlineAt" | "state">) {
  if (request.state === "determined" && request.determinedAt) {
    return new Date(request.determinedAt).getTime() <= new Date(request.slaDeadlineAt).getTime()
      ? "Within SLA"
      : "SLA breached";
  }

  return `${formatDuration(Math.max(0, new Date(request.slaDeadlineAt).getTime() - Date.now()))} remaining`;
}

export function formatBusinessPolicyStatus(status: DelegatePlanAuditRow["businessPolicyStatus"]) {
  switch (status) {
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return "Pending";
  }
}

export function formatPaymentStatus(status: DelegatePlanAuditRow["paymentPolicyStatus"]) {
  switch (status) {
    case "paid":
      return "Paid";
    case "blocked":
      return "Blocked";
    default:
      return "Pending";
  }
}

export function formatCurrency(row: Pick<DelegatePlanAuditRow, "currency" | "incentiveValue" | "settlementToken">) {
  const amount = typeof row.incentiveValue === "number" ? row.incentiveValue : 0;
  return `${amount.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })} ${row.settlementToken?.symbol ?? row.currency}`;
}

export function businessPolicyStatusBadgeVariant(status: DelegatePlanAuditRow["businessPolicyStatus"]): "success" | "warning" | "neutral" {
  if (status === "approved") {
    return "success";
  }

  if (status === "rejected") {
    return "warning";
  }

  return "neutral";
}

export function paymentStatusBadgeVariant(status: DelegatePlanAuditRow["paymentPolicyStatus"]): "success" | "warning" | "neutral" {
  if (status === "paid") {
    return "success";
  }

  if (status === "blocked") {
    return "warning";
  }

  return "neutral";
}

function formatDuration(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}
