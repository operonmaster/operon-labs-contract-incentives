import { describe, expect, it, vi } from "vitest";
import {
  PolicyBoundHbarTransferHook,
  buildHederaTransactionMemo,
  buildPaymentIntent,
  createHederaSettlementConfigFromEnv,
  createInMemoryPaymentIntentStore,
  executePolicyBoundPayment,
  parseHederaTransactionId,
  HEDERA_TRANSFER_HBAR_TOOL,
  type HederaAgentKitTransferRunner
} from "../src/index";

describe("Hedera policy-bound payment executor", () => {
  const caseId = "PA-260524-2102-AAAA1111";

  it("reads real testnet settlement configuration from environment variables", () => {
    const config = createHederaSettlementConfigFromEnv({
      HEDERA_OPERATOR_ACCOUNT_ID: "0.0.1001",
      HEDERA_OPERATOR_PRIVATE_KEY: "302e020100300506032b657004220420abcdef",
      HEDERA_ALLOWED_RECIPIENT_ACCOUNT_IDS: "0.0.23456, 0.0.34567",
      HEDERA_BLOCKED_RECIPIENT_ACCOUNT_IDS: "0.0.99999",
      HEDERA_MAX_PAYMENT_HBAR: "1.5"
    });

    expect(config).toEqual({
      mode: "real",
      network: "testnet",
      operatorAccountId: "0.0.1001",
      operatorPrivateKey: "302e020100300506032b657004220420abcdef",
      allowedRecipientAccountIds: ["0.0.23456", "0.0.34567"],
      blockedRecipientAccountIds: ["0.0.99999"],
      maxPaymentHbar: 1.5
    });
  });

  it("requires operator credentials for real settlement", () => {
    expect(() => createHederaSettlementConfigFromEnv({})).toThrow("HEDERA_OPERATOR_ACCOUNT_ID_REQUIRED");
    expect(
      createHederaSettlementConfigFromEnv({
        HEDERA_OPERATOR_ACCOUNT_ID: "0.0.1001",
        HEDERA_OPERATOR_PRIVATE_KEY: "302e020100300506032b657004220420abcdef"
      })
    ).toMatchObject({
      mode: "real",
      allowedRecipientAccountIds: []
    });
  });

  it("allows explicit simulated settlement without operator credentials", () => {
    const config = createHederaSettlementConfigFromEnv({
      HEDERA_SETTLEMENT_MODE: "simulated"
    });

    expect(config).toMatchObject({
      mode: "simulated",
      network: "testnet",
      allowedRecipientAccountIds: [],
      blockedRecipientAccountIds: [],
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
        incentiveEvaluationId: caseId,
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
          blockedRecipientAccountIds: [],
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
        transactionMemo: caseId
      }),
      expect.objectContaining({ mode: "real", network: "testnet" })
    );
  });

  it("uses plan-level Agent Kit controls to attest the business evaluation before settlement", async () => {
    const runner: HederaAgentKitTransferRunner = {
      runHbarTransfer: vi.fn(async () => ({
        transactionId: "0.0.1001@1716500000.000000001",
        rawResponse: "HBAR successfully transferred.\nTransaction ID: 0.0.1001@1716500000.000000001"
      }))
    };
    const businessEvaluationStore = {
      getAttestation: vi.fn(async () => ({
        incentiveEvaluationId: caseId,
        caseId,
        planId: "acme-health-ppo",
        businessPolicyId: "provider-documentation-completeness-v1",
        businessPolicyVersion: "v1",
        businessPolicyStatus: "active" as const,
        amount: 5,
        currency: "HBAR" as const,
        walletId: "0.0.23456"
      }))
    };

    const result = await executePolicyBoundPayment(
      {
        auditId: "audit-provider-documentation-completeness-v1-1234567890",
        caseId,
        incentiveEvaluationId: caseId,
        planId: "acme-health-ppo",
        amount: 5,
        currency: "HBAR",
        walletId: "0.0.23456",
        policyId: "provider-documentation-completeness-v1",
        policyVersion: "v1",
        triggerEvent: "PAS_SUBMITTED"
      },
      {
        config: {
          mode: "real",
          network: "testnet",
          operatorAccountId: "0.0.1001",
          operatorPrivateKey: "302e020100300506032b657004220420abcdef",
          allowedRecipientAccountIds: [],
          blockedRecipientAccountIds: [],
          maxPaymentHbar: 50
        },
        planPolicy: {
          planId: "acme-health-ppo",
          planName: "Acme Health PPO",
          status: "active",
          version: "v1",
          businessEvaluationAttestation: true,
          duplicatePaymentPrevention: true,
          maxPaymentPerRequest: true,
          paymentToken: "HBAR",
          maxPaymentAmount: 5,
          paymentEnvelopeIntegrity: true
        },
        businessEvaluationStore,
        runner
      }
    );

    expect(result).toMatchObject({
      status: "submitted",
      paymentIntentId: caseId
    });
    expect(businessEvaluationStore.getAttestation).toHaveBeenCalledTimes(1);
    expect(businessEvaluationStore.getAttestation).toHaveBeenCalledWith({
      incentiveEvaluationId: caseId,
      caseId,
      planId: "acme-health-ppo",
      policyId: "provider-documentation-completeness-v1"
    });
    expect(runner.runHbarTransfer).toHaveBeenCalledTimes(1);
  });

  it("blocks settlement when the recorded business evaluation does not match the payment envelope", async () => {
    const runner: HederaAgentKitTransferRunner = {
      runHbarTransfer: vi.fn(async () => ({
        transactionId: "0.0.1001@1716500000.000000001",
        rawResponse: "not expected"
      }))
    };
    const businessEvaluationStore = {
      getAttestation: vi.fn(async () => ({
        incentiveEvaluationId: caseId,
        caseId,
        planId: "acme-health-ppo",
        businessPolicyId: "provider-documentation-completeness-v1",
        businessPolicyVersion: "v1",
        businessPolicyStatus: "active" as const,
        amount: 5,
        currency: "HBAR" as const,
        walletId: "0.0.99999"
      }))
    };

    await expect(
      executePolicyBoundPayment(
        {
          auditId: "audit-provider-documentation-completeness-v1-1234567890",
          caseId,
          incentiveEvaluationId: caseId,
          planId: "acme-health-ppo",
          amount: 5,
          currency: "HBAR",
          walletId: "0.0.23456",
          policyId: "provider-documentation-completeness-v1",
          policyVersion: "v1",
          triggerEvent: "PAS_SUBMITTED"
        },
        {
          config: {
            mode: "real",
            network: "testnet",
            operatorAccountId: "0.0.1001",
            operatorPrivateKey: "302e020100300506032b657004220420abcdef",
            allowedRecipientAccountIds: [],
            blockedRecipientAccountIds: [],
            maxPaymentHbar: 50
          },
          planPolicy: {
            planId: "acme-health-ppo",
            planName: "Acme Health PPO",
            status: "active",
            version: "v1",
            businessEvaluationAttestation: true,
            duplicatePaymentPrevention: true,
            maxPaymentPerRequest: true,
            paymentToken: "HBAR",
            maxPaymentAmount: 5,
            paymentEnvelopeIntegrity: true
          },
          businessEvaluationStore,
          runner
        }
      )
    ).rejects.toThrow("BUSINESS_EVALUATION_WALLET_MISMATCH");
    expect(businessEvaluationStore.getAttestation).toHaveBeenCalledTimes(1);
    expect(runner.runHbarTransfer).not.toHaveBeenCalled();
  });

  it("does not report a completed Hedera transfer as failed when post-transfer intent persistence fails", async () => {
    const runner: HederaAgentKitTransferRunner = {
      runHbarTransfer: vi.fn(async () => ({
        transactionId: "0.0.1001@1716500000.000000001",
        rawResponse: "HBAR successfully transferred.\nTransaction ID: 0.0.1001@1716500000.000000001"
      }))
    };
    const store = {
      reserveIntent: vi.fn(async () => ({ allowed: true })),
      markIntentSubmitted: vi.fn(async () => {
        throw new Error("FIRESTORE_WRITE_FAILED");
      }),
      markIntentFailed: vi.fn()
    };

    const result = await executePolicyBoundPayment(
      {
        auditId: "audit-provider-documentation-completeness-v1-1234567890",
        caseId,
        incentiveEvaluationId: caseId,
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
          blockedRecipientAccountIds: [],
          maxPaymentHbar: 5
        },
        runner,
        paymentIntentStore: store
      }
    );

    expect(result).toMatchObject({
      status: "submitted",
      transactionId: "0.0.1001@1716500000.000000001"
    });
    expect(store.markIntentFailed).not.toHaveBeenCalled();
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
      blockedRecipientAccountIds: ["0.0.77777"],
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
    await expect(
      executePolicyBoundPayment({ auditId: "audit-1", amount: 1, currency: "HBAR", walletId: "0.0.77777" }, { config, runner })
    ).rejects.toThrow("RECIPIENT_WALLET_BLOCKED");

    expect(runner.runHbarTransfer).not.toHaveBeenCalled();
  });

  it("uses the canonical PA id as the deterministic payment intent for duplicate-payment prevention", () => {
    const first = buildPaymentIntent({
      auditId: "audit-1",
      caseId,
      incentiveEvaluationId: caseId,
      amount: 5,
      currency: "HBAR",
      walletId: "0.0.23456",
      policyId: "provider-documentation-completeness-v1",
      policyVersion: "v1",
      triggerEvent: "PAS_SUBMITTED"
    }, {
      sourceAccountId: "0.0.1001",
      transactionMemo: caseId
    });
    const second = buildPaymentIntent({
      auditId: "audit-2",
      caseId,
      incentiveEvaluationId: caseId,
      amount: 5,
      currency: "HBAR",
      walletId: "0.0.23456",
      policyId: "provider-documentation-completeness-v1",
      policyVersion: "v1",
      triggerEvent: "PAS_SUBMITTED"
    }, {
      sourceAccountId: "0.0.1001",
      transactionMemo: caseId
    });

    expect(first.id).toBe(second.id);
    expect(first.id).toBe(caseId);
    expect(first).toMatchObject({
      caseId,
      incentiveEvaluationId: caseId,
      policyId: "provider-documentation-completeness-v1",
      triggerEvent: "PAS_SUBMITTED",
      token: "HBAR",
      amount: 5,
      recipientAccountId: "0.0.23456"
    });
  });

  it("falls back to a hashed payment intent id only when no canonical PA id is supplied", () => {
    const intent = buildPaymentIntent({
      auditId: "audit-1",
      amount: 5,
      currency: "HBAR",
      walletId: "0.0.23456",
      policyId: "provider-documentation-completeness-v1"
    }, {
      sourceAccountId: "0.0.1001",
      transactionMemo: caseId
    });

    expect(intent.id).toMatch(/^pi_[a-f0-9]{32}$/);
  });

  it("rejects payment envelopes with mismatched case and incentive evaluation ids", () => {
    expect(() =>
      buildPaymentIntent({
        auditId: "audit-1",
        caseId,
        incentiveEvaluationId: "PA-260524-2102-BBBBBBBB",
        amount: 5,
        currency: "HBAR",
        walletId: "0.0.23456",
        policyId: "provider-documentation-completeness-v1"
      }, {
        sourceAccountId: "0.0.1001",
        transactionMemo: caseId
      })
    ).toThrow("PAYMENT_ID_MISMATCH");
  });

  it("uses the Agent Kit policy hook to reserve an intent and block duplicate transfers", async () => {
    const store = createInMemoryPaymentIntentStore();
    const config = {
      mode: "real" as const,
      network: "testnet" as const,
      operatorAccountId: "0.0.1001",
      operatorPrivateKey: "302e020100300506032b657004220420abcdef",
      allowedRecipientAccountIds: ["0.0.23456"],
      blockedRecipientAccountIds: [],
      maxPaymentHbar: 5
    };
    const request = {
      auditId: "audit-1",
      caseId,
      incentiveEvaluationId: caseId,
      amount: 5,
      currency: "HBAR" as const,
      walletId: "0.0.23456",
      policyId: "provider-documentation-completeness-v1",
      policyVersion: "v1",
      triggerEvent: "PAS_SUBMITTED"
    };
    const expectedTransfer = {
      sourceAccountId: "0.0.1001",
      recipientAccountId: "0.0.23456",
      amountHbar: 5,
      transactionMemo: buildHederaTransactionMemo(request)
    };
    const paymentIntent = buildPaymentIntent(request, {
      sourceAccountId: expectedTransfer.sourceAccountId,
      transactionMemo: expectedTransfer.transactionMemo
    });
    const rawParams = {
      sourceAccountId: "0.0.1001",
      transfers: [{ accountId: "0.0.23456", amount: 5 }],
      transactionMemo: expectedTransfer.transactionMemo
    };

    await new PolicyBoundHbarTransferHook(expectedTransfer, config, paymentIntent, store).preToolExecutionHook(
      { rawParams } as never,
      HEDERA_TRANSFER_HBAR_TOOL
    );

    await expect(
      new PolicyBoundHbarTransferHook(expectedTransfer, config, paymentIntent, store).preToolExecutionHook(
        { rawParams } as never,
        HEDERA_TRANSFER_HBAR_TOOL
      )
    ).rejects.toThrow("DUPLICATE_PAYMENT_BLOCKED");
  });

  it("uses the Agent Kit policy hook to block wallet, amount, source, and memo tampering", async () => {
    const config = {
      mode: "real" as const,
      network: "testnet" as const,
      operatorAccountId: "0.0.1001",
      operatorPrivateKey: "302e020100300506032b657004220420abcdef",
      allowedRecipientAccountIds: ["0.0.23456"],
      blockedRecipientAccountIds: ["0.0.99999"],
      maxPaymentHbar: 5
    };
    const expectedTransfer = {
      sourceAccountId: "0.0.1001",
      recipientAccountId: "0.0.23456",
      amountHbar: 5,
      transactionMemo: caseId
    };
    const hook = new PolicyBoundHbarTransferHook(expectedTransfer, config);

    await expect(
      hook.preToolExecutionHook(
        { rawParams: { sourceAccountId: "0.0.9999", transfers: [{ accountId: "0.0.23456", amount: 5 }], transactionMemo: expectedTransfer.transactionMemo } } as never,
        HEDERA_TRANSFER_HBAR_TOOL
      )
    ).rejects.toThrow("HEDERA_POLICY_SOURCE_ACCOUNT_MISMATCH");
    await expect(
      hook.preToolExecutionHook(
        { rawParams: { sourceAccountId: "0.0.1001", transfers: [{ accountId: "0.0.99999", amount: 5 }], transactionMemo: expectedTransfer.transactionMemo } } as never,
        HEDERA_TRANSFER_HBAR_TOOL
      )
    ).rejects.toThrow("RECIPIENT_WALLET_BLOCKED");
    await expect(
      hook.preToolExecutionHook(
        { rawParams: { sourceAccountId: "0.0.1001", transfers: [{ accountId: "0.0.23456", amount: 6 }], transactionMemo: expectedTransfer.transactionMemo } } as never,
        HEDERA_TRANSFER_HBAR_TOOL
      )
    ).rejects.toThrow("HEDERA_PAYMENT_AMOUNT_EXCEEDS_MAX");
    await expect(
      hook.preToolExecutionHook(
        { rawParams: { sourceAccountId: "0.0.1001", transfers: [{ accountId: "0.0.23456", amount: 5 }], transactionMemo: "tampered" } } as never,
        HEDERA_TRANSFER_HBAR_TOOL
      )
    ).rejects.toThrow("HEDERA_POLICY_MEMO_MISMATCH");
  });

  it("uses only the incentive evaluation id as the Hedera transaction memo", () => {
    const memo = buildHederaTransactionMemo({
      auditId: "audit-with spaces and symbols !@#$%^&*() and a very long suffix that should be clipped before it can exceed memo limits",
      caseId,
      incentiveEvaluationId: caseId,
      amount: 1,
      currency: "HBAR",
      walletId: "0.0.23456",
      policyId: "provider-documentation-completeness-v1",
      triggerEvent: "PAS_SUBMITTED"
    });

    expect(memo).toBe(caseId);
    expect(memo.length).toBeLessThanOrEqual(100);
    expect(memo).not.toContain("policy");
    expect(memo).not.toContain("event");
    expect(memo).not.toContain("Maya");
    expect(memo).not.toContain("Chen");
  });

  it("requires an incentive evaluation id before building a Hedera transaction memo", () => {
    expect(() =>
      buildHederaTransactionMemo({
        auditId: "audit-1",
        caseId,
        amount: 1,
        currency: "HBAR",
        walletId: "0.0.23456",
        policyId: "provider-documentation-completeness-v1",
        triggerEvent: "PAS_SUBMITTED"
      })
    ).toThrow("INCENTIVE_EVALUATION_ID_REQUIRED");
  });

  it("extracts a clean transaction ID from Agent Kit response text", () => {
    expect(parseHederaTransactionId('{"message":"HBAR successfully transferred. Transaction ID: 0.0.6870566@1779684783.307399930"}')).toBe(
      "0.0.6870566@1779684783.307399930"
    );
    expect(parseHederaTransactionId("Transaction ID: 0.0.1001@1716500000.000000001")).toBe("0.0.1001@1716500000.000000001");
  });
});
