import type { AppealCase, AppealCaseState, AppealsSlaStatus } from "../../lib/appeals-store";
import type { AppealsPlanAuditRow, AppealsPriorAuthRow } from "../../lib/appeals-workflow";

export function formatAppealState(state: AppealCaseState): string {
  switch (state) {
    case "created":
      return "Created";
    case "acknowledged":
      return "Acknowledged";
    case "intake_validated":
      return "Intake Validated";
    case "decision_retrieved":
      return "Decision Retrieved";
    case "missing_info_resolved":
      return "Missing Info Resolved";
    case "packet_assembled":
      return "Packet Assembled";
    case "evidence_indexed":
      return "Evidence Indexed";
    case "packet_ready":
      return "Packet Ready";
  }
}

export function appealStateBadgeVariant(state: AppealCaseState): "info" | "success" | "warning" | "neutral" {
  if (state === "packet_ready") {
    return "success";
  }

  if (state === "created") {
    return "neutral";
  }

  return "info";
}

export function formatPriorAuthState(state: AppealsPriorAuthRow["state"]): string {
  return formatSnakeCase(state);
}

export function formatPriorAuthOutcome(outcome: AppealsPriorAuthRow["outcomeStatus"]): string {
  if (!outcome) {
    return "Pending";
  }

  return formatSnakeCase(outcome);
}

export function formatAppealEligibility(row: AppealsPriorAuthRow): string {
  if (row.appealCase) {
    return formatAppealState(row.appealCase.state);
  }

  switch (row.eligibilityStatus) {
    case "startable":
      return "Startable";
    case "open":
      return "Open";
    case "not_appeal_eligible":
      return "Not eligible";
    default:
      return "Awaiting determination";
  }
}

export function formatRequestType(requestType: AppealsPlanAuditRow["requestType"] | AppealsPriorAuthRow["requestType"]): string {
  switch (requestType) {
    case "pharmacy_benefit":
      return "Pharmacy Benefit";
    case "outpatient_service":
      return "Outpatient Service";
    case "inpatient_admission":
      return "Inpatient Admission";
    default:
      return "Unknown request type";
  }
}

export function formatSlaStatus(status: AppealsSlaStatus): string {
  switch (status) {
    case "within_sla":
      return "Within SLA";
    case "breached":
      return "Breached";
    case "not_applicable":
      return "Not applicable";
    default:
      return "Pending";
  }
}

export function slaBadgeVariant(status: AppealsSlaStatus): "info" | "success" | "warning" | "neutral" {
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

export function formatBusinessPolicyStatus(status: AppealsPlanAuditRow["businessPolicyStatus"]): string {
  if (status === "approved") {
    return "Approved";
  }

  if (status === "rejected") {
    return "Rejected";
  }

  return "Pending";
}

export function businessPolicyStatusBadgeVariant(
  status: AppealsPlanAuditRow["businessPolicyStatus"]
): "success" | "warning" | "neutral" {
  if (status === "approved") {
    return "success";
  }

  if (status === "rejected") {
    return "warning";
  }

  return "neutral";
}

export function formatPaymentPolicyStatus(status: AppealsPlanAuditRow["paymentPolicyStatus"]): string {
  if (status === "paid") {
    return "Paid";
  }

  if (status === "blocked") {
    return "Blocked";
  }

  return "Pending";
}

export function paymentPolicyStatusBadgeVariant(
  status: AppealsPlanAuditRow["paymentPolicyStatus"]
): "success" | "warning" | "neutral" {
  if (status === "paid") {
    return "success";
  }

  if (status === "blocked") {
    return "warning";
  }

  return "neutral";
}

export function formatCurrency(row: Pick<AppealsPlanAuditRow, "currency" | "incentiveValue" | "settlementToken">): string {
  return `${row.incentiveValue.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })} ${row.settlementToken?.symbol ?? row.currency}`;
}

export function formatNullableDateTime(value: string | null | undefined): string {
  if (!value) {
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

export function formatYesNo(value: boolean | undefined): string {
  if (value === undefined) {
    return "Not recorded";
  }

  return value ? "Yes" : "No";
}

export function formatAppealSource(value: AppealCase["source"] | undefined): string {
  return value === "provider_started_from_denied_pa" ? "Provider started from denied PA" : "Not recorded";
}

function formatSnakeCase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
