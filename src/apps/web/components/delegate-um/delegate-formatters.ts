import type { DelegateUmRow } from "../../lib/delegate-um-workflow";

export function formatRequestType(requestType: DelegateUmRow["requestType"]) {
  switch (requestType) {
    case "outpatient_service":
      return "Outpatient Service";
    case "pharmacy_benefit":
      return "Pharmacy Benefit";
    case "inpatient_admission":
      return "Inpatient Admission";
  }
}

export function formatUmState(state: DelegateUmRow["state"]) {
  switch (state) {
    case "pend":
      return "Pended";
    case "in_clinical_review":
      return "In clinical review";
    case "determined":
      return "Determined";
  }
}

export function formatOutcomeStatus(outcomeStatus: DelegateUmRow["outcomeStatus"]) {
  if (!outcomeStatus) {
    return "Pending";
  }

  return outcomeStatus === "approved" ? "Approved" : "Denied";
}

export function formatSlaStatus(row: Pick<DelegateUmRow, "slaStatus" | "timeRemainingMs">) {
  if (row.slaStatus === "within_sla") {
    return "Within SLA";
  }

  if (row.slaStatus === "breached") {
    return "SLA breached";
  }

  return `${formatDuration(row.timeRemainingMs)} remaining`;
}

export function formatIncentiveStatus(status: DelegateUmRow["incentiveStatus"]) {
  switch (status) {
    case "pending":
      return "Pending";
    case "not_eligible":
      return "Not eligible";
    case "paid":
      return "Paid";
    case "payment_failed":
      return "Payment failed";
  }
}

export function formatPaymentStatus(status: DelegateUmRow["paymentStatus"]) {
  switch (status) {
    case "pending":
      return "Pending";
    case "auto_executed":
      return "Auto-settled";
    case "blocked_by_policy":
      return "Blocked by policy";
    case "execution_failed":
      return "Execution failed";
  }
}

export function formatCurrency(row: Pick<DelegateUmRow, "currency" | "incentiveValue" | "settlementToken">) {
  return `${row.incentiveValue.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })} ${row.settlementToken?.symbol ?? row.currency}`;
}

export function incentiveBadgeVariant(status: DelegateUmRow["incentiveStatus"]): "success" | "warning" | "neutral" {
  if (status === "paid") {
    return "success";
  }

  if (status === "not_eligible" || status === "payment_failed") {
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
