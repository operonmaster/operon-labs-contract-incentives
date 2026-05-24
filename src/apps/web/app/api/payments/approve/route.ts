import { executeApprovedPayment, type PaymentApprovalRequest } from "@operon-labs/hedera-executor";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!isPaymentApprovalRequest(body)) {
    return NextResponse.json(
      {
        error: "INVALID_PAYMENT_APPROVAL_REQUEST"
      },
      {
        status: 400
      }
    );
  }

  const result = await executeApprovedPayment(body);
  return NextResponse.json(result);
}

function isPaymentApprovalRequest(value: unknown): value is PaymentApprovalRequest {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.auditId === "string" &&
    typeof candidate.amount === "number" &&
    (candidate.currency === "HBAR" || candidate.currency === "USDC") &&
    typeof candidate.walletId === "string"
  );
}
