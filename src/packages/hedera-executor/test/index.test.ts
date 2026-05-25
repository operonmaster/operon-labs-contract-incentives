import { describe, expect, it, vi } from "vitest";
import {
  buildHederaTransactionMemo,
  createHederaSettlementConfigFromEnv,
  executePolicyBoundPayment,
  parseHederaTransactionId,
  type HederaAgentKitTransferRunner
} from "../src/index";

describe("Hedera policy-bound payment executor", () => {
  const caseId = "PA-260524-2102-AAAA1111";

  it("reads real testnet settlement configuration from environment variables", () => {
    const config = createHederaSettlementConfigFromEnv({
      HEDERA_OPERATOR_ACCOUNT_ID: "0.0.1001",
      HEDERA_OPERATOR_PRIVATE_KEY: "302e020100300506032b657004220420abcdef",
      HEDERA_ALLOWED_RECIPIENT_ACCOUNT_IDS: "0.0.23456, 0.0.34567",
      HEDERA_MAX_PAYMENT_HBAR: "1.5"
    });

    expect(config).toEqual({
      mode: "real",
      network: "testnet",
      operatorAccountId: "0.0.1001",
      operatorPrivateKey: "302e020100300506032b657004220420abcdef",
      allowedRecipientAccountIds: ["0.0.23456", "0.0.34567"],
      maxPaymentHbar: 1.5
    });
  });

  it("requires operator credentials and recipient allowlist for real settlement", () => {
    expect(() => createHederaSettlementConfigFromEnv({})).toThrow("HEDERA_OPERATOR_ACCOUNT_ID_REQUIRED");
    expect(() =>
      createHederaSettlementConfigFromEnv({
        HEDERA_OPERATOR_ACCOUNT_ID: "0.0.1001",
        HEDERA_OPERATOR_PRIVATE_KEY: "302e020100300506032b657004220420abcdef"
      })
    ).toThrow("HEDERA_ALLOWED_RECIPIENT_ACCOUNT_IDS_REQUIRED");
  });

  it("allows explicit simulated settlement without operator credentials", () => {
    const config = createHederaSettlementConfigFromEnv({
      HEDERA_SETTLEMENT_MODE: "simulated"
    });

    expect(config).toMatchObject({
      mode: "simulated",
      network: "testnet",
      allowedRecipientAccountIds: [],
      maxPaymentHbar: 5
    });
  });

  it("executes an approved HBAR payment through an injected Agent Kit runner", async () => {
    const runner: HederaAgentKitTransferRunner = {
      runHbarTransfer: vi.fn(async () => ({
        transactionId: "0.0.1001@1716500000.000000001",
        rawResponse: "HBAR successfully transferred.\nTransaction ID: 0.0.1001@1716500000.000000001"
      }))
    };

    const result = await executePolicyBoundPayment(
      {
        auditId: "audit-provider-documentation-completeness-v1-1234567890",
        caseId,
        amount: 5,
        currency: "HBAR",
        walletId: "0.0.23456",
        policyId: "provider-documentation-completeness-v1",
        policyVersion: "v1",
        triggerEvent: "PAS_SUBMITTED",
        policyControls: ["Allowed submitter and recipient wallet", "5 HBAR max per PA request"]
      },
      {
        config: {
          mode: "real",
          network: "testnet",
          operatorAccountId: "0.0.1001",
          operatorPrivateKey: "302e020100300506032b657004220420abcdef",
          allowedRecipientAccountIds: ["0.0.23456"],
          maxPaymentHbar: 5
        },
        runner
      }
    );

    expect(result).toMatchObject({
      status: "submitted",
      network: "testnet",
      transactionId: "0.0.1001@1716500000.000000001",
      runtime: "hedera-agent-kit-policy"
    });
    expect(runner.runHbarTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientAccountId: "0.0.23456",
        amountHbar: 5,
        transactionMemo: expect.stringContaining(`olabs|case:${caseId}`)
      }),
      expect.objectContaining({ mode: "real", network: "testnet" })
    );
  });

  it("blocks unsupported settlement tokens, invalid amounts, and non-allowlisted wallets before runner execution", async () => {
    const runner: HederaAgentKitTransferRunner = {
      runHbarTransfer: vi.fn(async () => ({
        transactionId: "0.0.1001@1716500000.000000001",
        rawResponse: "not expected"
      }))
    };
    const config = {
      mode: "real" as const,
      network: "testnet" as const,
      operatorAccountId: "0.0.1001",
      operatorPrivateKey: "302e020100300506032b657004220420abcdef",
      allowedRecipientAccountIds: ["0.0.23456"],
      maxPaymentHbar: 5
    };

    await expect(
      executePolicyBoundPayment({ auditId: "audit-1", amount: 1, currency: "OPRN", walletId: "0.0.23456" }, { config, runner })
    ).rejects.toThrow("HEDERA_TOKEN_TRANSFER_NOT_IMPLEMENTED");
    await expect(
      executePolicyBoundPayment({ auditId: "audit-1", amount: 0, currency: "HBAR", walletId: "0.0.23456" }, { config, runner })
    ).rejects.toThrow("INVALID_HEDERA_PAYMENT_AMOUNT");
    await expect(
      executePolicyBoundPayment({ auditId: "audit-1", amount: 6, currency: "HBAR", walletId: "0.0.23456" }, { config, runner })
    ).rejects.toThrow("HEDERA_PAYMENT_AMOUNT_EXCEEDS_MAX");
    await expect(
      executePolicyBoundPayment({ auditId: "audit-1", amount: 1, currency: "HBAR", walletId: "0.0.99999" }, { config, runner })
    ).rejects.toThrow("RECIPIENT_WALLET_NOT_ALLOWED");

    expect(runner.runHbarTransfer).not.toHaveBeenCalled();
  });

  it("keeps transaction memo non-PHI and within Hedera memo length limits", () => {
    const memo = buildHederaTransactionMemo({
      auditId: "audit-with spaces and symbols !@#$%^&*() and a very long suffix that should be clipped before it can exceed memo limits",
      caseId,
      amount: 1,
      currency: "HBAR",
      walletId: "0.0.23456",
      policyId: "provider-documentation-completeness-v1",
      triggerEvent: "PAS_SUBMITTED"
    });

    expect(memo).toMatch(new RegExp(`^olabs\\|case:${caseId}\\|policy:provider-documentation-completeness-v1`));
    expect(memo.length).toBeLessThanOrEqual(100);
    expect(memo).not.toContain("Maya");
    expect(memo).not.toContain("Chen");
  });

  it("extracts a clean transaction ID from Agent Kit response text", () => {
    expect(parseHederaTransactionId('{"message":"HBAR successfully transferred. Transaction ID: 0.0.6870566@1779684783.307399930"}')).toBe(
      "0.0.6870566@1779684783.307399930"
    );
    expect(parseHederaTransactionId("Transaction ID: 0.0.1001@1716500000.000000001")).toBe("0.0.1001@1716500000.000000001");
  });
});
