import { describe, expect, it, vi } from "vitest";
import { executeApprovedPayment } from "@operon-labs/hedera-executor";
import { POST } from "./route";

vi.mock("@operon-labs/hedera-executor", () => ({
  executeApprovedPayment: vi.fn()
}));

describe("deprecated payment approval route", () => {
  it("does not execute generic caller-supplied payment approvals", async () => {
    const response = await POST(
      new Request("http://localhost/api/payments/approve", {
        method: "POST",
        body: JSON.stringify({
          auditId: "audit-1",
          amount: 5,
          currency: "HBAR",
          walletId: "0.0.9049549"
        })
      })
    );

    await expect(response.json()).resolves.toEqual({ error: "PAYMENT_APPROVAL_ROUTE_DISABLED" });
    expect(response.status).toBe(410);
    expect(executeApprovedPayment).not.toHaveBeenCalled();
  });
});
