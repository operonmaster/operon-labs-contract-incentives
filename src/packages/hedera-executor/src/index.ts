import { AgentMode, HederaAgentAPI, AbstractHook, type Context, type PreToolExecutionParams } from "@hashgraph/hedera-agent-kit";
import { coreAccountPlugin, coreAccountPluginToolNames } from "@hashgraph/hedera-agent-kit/plugins";
import { Client, PrivateKey } from "@hiero-ledger/sdk";
import { createHash } from "node:crypto";
import type { Currency } from "@operon-labs/policy-engine";

export interface PaymentApprovalRequest {
  auditId: string;
  caseId?: string;
  incentiveEvaluationId?: string;
  planId?: string;
  amount: number;
  currency: Currency;
  walletId: string;
  policyId?: string;
  policyVersion?: string;
  triggerEvent?: string;
  policyControls?: string[];
}

export type HederaSettlementMode = "real" | "simulated";
export type HederaNetwork = "testnet";

export interface HederaSettlementConfig {
  mode: HederaSettlementMode;
  network: HederaNetwork;
  operatorAccountId?: string;
  operatorPrivateKey?: string;
  allowedRecipientAccountIds: string[];
  blockedRecipientAccountIds: string[];
  maxPaymentHbar: number;
}

export interface HederaAgentPlanPolicy {
  planId: string;
  planName: string;
  status: "active" | "inactive";
  version: string;
  businessEvaluationAttestation: boolean;
  duplicatePaymentPrevention: boolean;
  maxPaymentPerRequest: boolean;
  paymentToken: Currency;
  maxPaymentAmount: number;
  paymentEnvelopeIntegrity: boolean;
}

export interface HederaHbarTransferInput {
  sourceAccountId: string;
  recipientAccountId: string;
  amountHbar: number;
  transactionMemo: string;
}

export interface HederaHbarTransferOutput {
  transactionId: string;
  rawResponse: string;
}

export interface HederaAgentKitTransferRunner {
  runHbarTransfer(
    input: HederaHbarTransferInput,
    config: HederaSettlementConfig,
    policyContext?: HederaExecutionPolicyContext
  ): Promise<HederaHbarTransferOutput>;
}

export interface ExecutePolicyBoundPaymentOptions {
  config?: HederaSettlementConfig;
  planPolicy?: HederaAgentPlanPolicy;
  runner?: HederaAgentKitTransferRunner;
  paymentIntentStore?: PaymentIntentStore;
  businessEvaluationStore?: BusinessEvaluationAttestationStore;
}

export interface PaymentExecutionResult {
  status: "simulated" | "submitted";
  network: "testnet";
  transactionId: string;
  runtime: "hedera-agent-kit-policy";
  paymentIntentId: string;
  rawResponse?: string;
  explorerUrl?: string;
}

export type PaymentIntentStatus = "reserved" | "submitted" | "failed";

export interface PaymentIntent {
  id: string;
  auditId: string;
  caseId?: string;
  incentiveEvaluationId?: string;
  planId?: string;
  policyId?: string;
  policyVersion?: string;
  triggerEvent?: string;
  token: Currency;
  amount: number;
  sourceAccountId: string;
  recipientAccountId: string;
  transactionMemo: string;
  status: PaymentIntentStatus;
  transactionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentIntentReservation {
  allowed: boolean;
  reasonCode?: string;
  intent?: PaymentIntent;
}

/* eslint-disable no-unused-vars -- TypeScript interface method signatures require parameter names. */
export interface PaymentIntentStore {
  reserveIntent(intent: PaymentIntent): Promise<PaymentIntentReservation>;
  markIntentSubmitted(intentId: string, transactionId: string): Promise<void>;
  markIntentFailed(intentId: string, reasonCode: string): Promise<void>;
}
/* eslint-enable no-unused-vars */

export interface HederaExecutionPolicyContext {
  paymentIntent: PaymentIntent;
  paymentIntentStore?: PaymentIntentStore;
  planPolicy?: HederaAgentPlanPolicy;
  businessEvaluationAttestation?: BusinessEvaluationAttestation;
}

export interface BusinessEvaluationAttestationLookup {
  incentiveEvaluationId: string;
  caseId?: string;
  planId: string;
  policyId?: string;
}

export interface BusinessEvaluationAttestation {
  incentiveEvaluationId: string;
  caseId: string;
  planId: string;
  businessPolicyId: string;
  businessPolicyVersion?: string;
  businessPolicyStatus: "active" | "inactive" | "missing";
  amount: number;
  currency: Currency;
  walletId: string;
}

/* eslint-disable no-unused-vars -- TypeScript interface method signatures require parameter names. */
export interface BusinessEvaluationAttestationStore {
  getAttestation(lookup: BusinessEvaluationAttestationLookup): Promise<BusinessEvaluationAttestation | null>;
}
/* eslint-enable no-unused-vars */

export const hederaAgentKitPolicyRuntime = {
  packageName: "@hashgraph/hedera-agent-kit",
  mode: "AUTONOMOUS",
  allowedTools: [coreAccountPluginToolNames.TRANSFER_HBAR_TOOL],
  hookStages: ["pre-tool execution", "post-parameter normalization", "post-core action", "post-tool execution"],
  settlementModel: "pre_authorized_policy_auto_settlement"
} as const;

const DEFAULT_MAX_PAYMENT_HBAR = 5;
const HEDERA_TRANSACTION_MEMO_LIMIT = 100;
export const HEDERA_TRANSFER_HBAR_TOOL = coreAccountPluginToolNames.TRANSFER_HBAR_TOOL;
const TRANSFER_HBAR_TOOL = HEDERA_TRANSFER_HBAR_TOOL;

export function createHederaSettlementConfigFromEnv(
  env: Record<string, string | undefined> = process.env
): HederaSettlementConfig {
  const rawMode = env.HEDERA_SETTLEMENT_MODE?.trim().toLowerCase() ?? "real";
  if (rawMode !== "real" && rawMode !== "simulated") {
    throw new Error("HEDERA_SETTLEMENT_MODE_INVALID");
  }

  const rawNetwork = env.HEDERA_NETWORK?.trim().toLowerCase() ?? "testnet";
  if (rawNetwork !== "testnet") {
    throw new Error("HEDERA_NETWORK_UNSUPPORTED");
  }

  const maxPaymentHbar = parsePositiveNumber(env.HEDERA_MAX_PAYMENT_HBAR, DEFAULT_MAX_PAYMENT_HBAR, "HEDERA_MAX_PAYMENT_HBAR_INVALID");
  const allowedRecipientAccountIds = splitCsv(env.HEDERA_ALLOWED_RECIPIENT_ACCOUNT_IDS);
  const blockedRecipientAccountIds = splitCsv(env.HEDERA_BLOCKED_RECIPIENT_ACCOUNT_IDS);
  const operatorAccountId = cleanOptional(env.HEDERA_OPERATOR_ACCOUNT_ID);
  const operatorPrivateKey = cleanOptional(env.HEDERA_OPERATOR_PRIVATE_KEY);

  if (rawMode === "real") {
    if (!operatorAccountId) {
      throw new Error("HEDERA_OPERATOR_ACCOUNT_ID_REQUIRED");
    }
    if (!operatorPrivateKey) {
      throw new Error("HEDERA_OPERATOR_PRIVATE_KEY_REQUIRED");
    }
  }

  return {
    mode: rawMode,
    network: rawNetwork,
    operatorAccountId,
    operatorPrivateKey,
    allowedRecipientAccountIds,
    blockedRecipientAccountIds,
    maxPaymentHbar
  };
}

export async function executePolicyBoundPayment(
  request: PaymentApprovalRequest,
  options: ExecutePolicyBoundPaymentOptions = {}
): Promise<PaymentExecutionResult> {
  const config = options.config ?? createHederaSettlementConfigFromEnv();
  validatePolicyBoundPayment(request, config, options.planPolicy);
  const businessEvaluationAttestation = await loadBusinessEvaluationAttestation(request, options);

  if (config.mode === "simulated") {
    const transactionId = `testnet-${request.auditId}-${request.currency.toLowerCase()}-${Date.now()}`;
    return {
      status: "simulated",
      network: config.network,
      transactionId,
      runtime: "hedera-agent-kit-policy",
      paymentIntentId: buildPaymentIntentId(request),
      rawResponse: "Explicit simulated settlement mode. No Hedera transaction was submitted."
    };
  }

  const sourceAccountId = requireConfigValue(config.operatorAccountId, "HEDERA_OPERATOR_ACCOUNT_ID_REQUIRED");
  const transactionMemo = buildHederaTransactionMemo(request);
  const paymentIntent = buildPaymentIntent(request, {
    sourceAccountId,
    transactionMemo
  });
  const runner = options.runner ?? new DefaultHederaAgentKitTransferRunner();
  let transfer: HederaHbarTransferOutput;
  const transferInput: HederaHbarTransferInput = {
    sourceAccountId,
    recipientAccountId: request.walletId,
    amountHbar: request.amount,
    transactionMemo
  };

  const executionPolicyContext =
    options.paymentIntentStore || options.planPolicy || businessEvaluationAttestation
      ? {
          paymentIntent,
          paymentIntentStore: options.paymentIntentStore,
          planPolicy: options.planPolicy,
          businessEvaluationAttestation
        }
      : undefined;

  try {
    transfer = executionPolicyContext
      ? await runner.runHbarTransfer(transferInput, config, executionPolicyContext)
      : await runner.runHbarTransfer(transferInput, config);
  } catch (error) {
    await options.paymentIntentStore?.markIntentFailed(paymentIntent.id, toErrorCode(error));
    throw error;
  }

  await options.paymentIntentStore?.markIntentSubmitted(paymentIntent.id, transfer.transactionId).catch(() => undefined);

  return {
    status: "submitted",
    network: config.network,
    transactionId: transfer.transactionId,
    runtime: "hedera-agent-kit-policy",
    paymentIntentId: paymentIntent.id,
    rawResponse: transfer.rawResponse,
    explorerUrl: buildHashscanTestnetTransactionUrl(transfer.transactionId)
  };
}

export const executeApprovedPayment = executePolicyBoundPayment;

export function buildHederaTransactionMemo(request: PaymentApprovalRequest): string {
  const memo = request.incentiveEvaluationId?.trim();
  if (!memo) {
    throw new Error("INCENTIVE_EVALUATION_ID_REQUIRED");
  }

  if (memo.length > HEDERA_TRANSACTION_MEMO_LIMIT) {
    throw new Error("HEDERA_TRANSACTION_MEMO_TOO_LONG");
  }

  if (sanitizeMemoPart(memo) !== memo) {
    throw new Error("HEDERA_TRANSACTION_MEMO_INVALID");
  }

  return memo;
}

export function buildPaymentIntent(
  request: PaymentApprovalRequest,
  execution: { sourceAccountId: string; transactionMemo: string },
  now: Date = new Date()
): PaymentIntent {
  const timestamp = now.toISOString();

  return {
    id: buildPaymentIntentId(request),
    auditId: request.auditId,
    caseId: request.caseId,
    incentiveEvaluationId: request.incentiveEvaluationId,
    planId: request.planId,
    policyId: request.policyId,
    policyVersion: request.policyVersion,
    triggerEvent: request.triggerEvent,
    token: request.currency,
    amount: request.amount,
    sourceAccountId: execution.sourceAccountId,
    recipientAccountId: request.walletId,
    transactionMemo: execution.transactionMemo,
    status: "reserved",
    transactionId: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function buildPaymentIntentId(request: PaymentApprovalRequest): string {
  const canonicalPaymentId = getCanonicalPaymentId(request);
  if (canonicalPaymentId) {
    return canonicalPaymentId;
  }

  const raw = [
    request.planId ?? "plan",
    request.auditId,
    request.policyId ?? "policy",
    request.currency
  ].join("|");

  return `pi_${createHash("sha256").update(raw).digest("hex").slice(0, 32)}`;
}

function getCanonicalPaymentId(request: PaymentApprovalRequest): string | null {
  const incentiveEvaluationId = request.incentiveEvaluationId?.trim();
  const caseId = request.caseId?.trim();

  if (incentiveEvaluationId && caseId && incentiveEvaluationId !== caseId) {
    throw new Error("PAYMENT_ID_MISMATCH");
  }

  return incentiveEvaluationId || caseId || null;
}

export function createInMemoryPaymentIntentStore(): PaymentIntentStore {
  const intents = new Map<string, PaymentIntent>();

  return {
    async reserveIntent(intent) {
      const existing = intents.get(intent.id);
      if (existing) {
        return {
          allowed: false,
          reasonCode: "DUPLICATE_PAYMENT_BLOCKED",
          intent: existing
        };
      }

      const reserved: PaymentIntent = {
        ...intent,
        status: "reserved",
        updatedAt: new Date().toISOString()
      };
      intents.set(intent.id, reserved);

      return {
        allowed: true,
        intent: reserved
      };
    },
    async markIntentSubmitted(intentId, transactionId) {
      const existing = intents.get(intentId);
      if (!existing) {
        return;
      }

      intents.set(intentId, {
        ...existing,
        status: "submitted",
        transactionId,
        updatedAt: new Date().toISOString()
      });
    },
    async markIntentFailed(intentId) {
      const existing = intents.get(intentId);
      if (!existing || existing.status === "submitted") {
        return;
      }

      intents.set(intentId, {
        ...existing,
        status: "failed",
        transactionId: null,
        updatedAt: new Date().toISOString()
      });
    }
  };
}

function validatePolicyBoundPayment(
  request: PaymentApprovalRequest,
  config: HederaSettlementConfig,
  planPolicy?: HederaAgentPlanPolicy
): void {
  if (request.currency !== "HBAR") {
    throw new Error("HEDERA_TOKEN_TRANSFER_NOT_IMPLEMENTED");
  }

  if (!Number.isFinite(request.amount) || request.amount <= 0) {
    throw new Error("INVALID_HEDERA_PAYMENT_AMOUNT");
  }

  if (planPolicy) {
    if (planPolicy.status !== "active") {
      throw new Error("HEDERA_PLAN_POLICY_INACTIVE");
    }

    if (request.planId && request.planId !== planPolicy.planId) {
      throw new Error("HEDERA_PLAN_POLICY_MISMATCH");
    }

    if (request.currency !== planPolicy.paymentToken) {
      throw new Error("HEDERA_PAYMENT_TOKEN_NOT_ALLOWED");
    }

    if (planPolicy.maxPaymentPerRequest && request.amount > planPolicy.maxPaymentAmount) {
      throw new Error("HEDERA_PAYMENT_AMOUNT_EXCEEDS_PLAN_MAX");
    }
  } else if (request.amount > config.maxPaymentHbar) {
    throw new Error("HEDERA_PAYMENT_AMOUNT_EXCEEDS_MAX");
  }

  if (!request.walletId || !/^0\.0\.\d+$/.test(request.walletId)) {
    throw new Error("INVALID_RECIPIENT_WALLET_ID");
  }

  validateRecipientTrust(request.walletId, config);
}

async function loadBusinessEvaluationAttestation(
  request: PaymentApprovalRequest,
  options: ExecutePolicyBoundPaymentOptions
): Promise<BusinessEvaluationAttestation | undefined> {
  const planPolicy = options.planPolicy;
  if (!planPolicy?.businessEvaluationAttestation) {
    return undefined;
  }

  const incentiveEvaluationId = request.incentiveEvaluationId ?? request.caseId;
  if (!incentiveEvaluationId) {
    throw new Error("INCENTIVE_EVALUATION_ID_REQUIRED");
  }

  if (!options.businessEvaluationStore) {
    throw new Error("BUSINESS_EVALUATION_ATTESTATION_STORE_REQUIRED");
  }

  const attestation = await options.businessEvaluationStore.getAttestation({
    incentiveEvaluationId,
    caseId: request.caseId,
    planId: planPolicy.planId,
    policyId: request.policyId
  });
  if (!attestation) {
    throw new Error("BUSINESS_EVALUATION_ATTESTATION_NOT_FOUND");
  }

  validateBusinessEvaluationAttestation(request, planPolicy, attestation);
  return attestation;
}

function validateBusinessEvaluationAttestation(
  request: PaymentApprovalRequest,
  planPolicy: HederaAgentPlanPolicy,
  attestation: BusinessEvaluationAttestation
): void {
  if (attestation.planId !== planPolicy.planId) {
    throw new Error("BUSINESS_EVALUATION_PLAN_MISMATCH");
  }

  if (request.caseId && attestation.caseId !== request.caseId) {
    throw new Error("BUSINESS_EVALUATION_CASE_MISMATCH");
  }

  if (request.policyId && attestation.businessPolicyId !== request.policyId) {
    throw new Error("BUSINESS_EVALUATION_POLICY_MISMATCH");
  }

  if (attestation.businessPolicyStatus !== "active") {
    throw new Error("BUSINESS_POLICY_NOT_ACTIVE");
  }

  if (attestation.amount !== request.amount) {
    throw new Error("BUSINESS_EVALUATION_AMOUNT_MISMATCH");
  }

  if (attestation.currency !== request.currency) {
    throw new Error("BUSINESS_EVALUATION_TOKEN_MISMATCH");
  }

  if (attestation.walletId !== request.walletId) {
    throw new Error("BUSINESS_EVALUATION_WALLET_MISMATCH");
  }
}

class DefaultHederaAgentKitTransferRunner implements HederaAgentKitTransferRunner {
  async runHbarTransfer(
    input: HederaHbarTransferInput,
    config: HederaSettlementConfig,
    policyContext?: HederaExecutionPolicyContext
  ): Promise<HederaHbarTransferOutput> {
    const operatorAccountId = requireConfigValue(config.operatorAccountId, "HEDERA_OPERATOR_ACCOUNT_ID_REQUIRED");
    const operatorPrivateKey = requireConfigValue(config.operatorPrivateKey, "HEDERA_OPERATOR_PRIVATE_KEY_REQUIRED");
    const client = Client.forTestnet().setOperator(operatorAccountId, PrivateKey.fromString(operatorPrivateKey));
    const context: Context = {
      accountId: operatorAccountId,
      mode: AgentMode.AUTONOMOUS,
      hooks: [
        new PolicyBoundHbarTransferHook(
          input,
          config,
          policyContext?.paymentIntent,
          policyContext?.paymentIntentStore,
          policyContext?.planPolicy,
          policyContext?.businessEvaluationAttestation
        )
      ]
    };
    const transferTool = coreAccountPlugin.tools(context).find((tool) => tool.method === TRANSFER_HBAR_TOOL);
    if (!transferTool) {
      throw new Error("HEDERA_TRANSFER_HBAR_TOOL_NOT_AVAILABLE");
    }

    const agent = new HederaAgentAPI(client, context, [transferTool]);
    const rawResponse = await agent.run(TRANSFER_HBAR_TOOL, {
      sourceAccountId: input.sourceAccountId,
      transfers: [{ accountId: input.recipientAccountId, amount: input.amountHbar }],
      transactionMemo: input.transactionMemo
    });

    return {
      transactionId: parseHederaTransactionId(rawResponse),
      rawResponse
    };
  }
}

export class PolicyBoundHbarTransferHook extends AbstractHook {
  name = "operon-policy-bound-hbar-transfer";
  description = "Blocks Hedera HBAR transfers that do not match the evaluated Operon Labs incentive policy result.";
  relevantTools = [TRANSFER_HBAR_TOOL];
  private reservationAttempted = false;

  constructor(
    private readonly expected: HederaHbarTransferInput,
    private readonly config: HederaSettlementConfig,
    private readonly paymentIntent?: PaymentIntent,
    private readonly paymentIntentStore?: PaymentIntentStore,
    private readonly planPolicy?: HederaAgentPlanPolicy,
    private readonly businessEvaluationAttestation?: BusinessEvaluationAttestation
  ) {
    super();
  }

  async preToolExecutionHook(params: PreToolExecutionParams, method: string): Promise<void> {
    if (method !== TRANSFER_HBAR_TOOL) {
      throw new Error("HEDERA_TOOL_NOT_ALLOWED");
    }

    const raw = params.rawParams as
      | {
          sourceAccountId?: string;
          transfers?: Array<{ accountId?: string; amount?: number }>;
          transactionMemo?: string;
        }
      | undefined;

    if (!raw || !Array.isArray(raw.transfers) || raw.transfers.length !== 1) {
      throw new Error("HEDERA_POLICY_REQUIRES_SINGLE_RECIPIENT");
    }

    const [transfer] = raw.transfers;
    if (raw.sourceAccountId && raw.sourceAccountId !== this.expected.sourceAccountId) {
      throw new Error("HEDERA_POLICY_SOURCE_ACCOUNT_MISMATCH");
    }

    if (transfer?.accountId) {
      validateRecipientTrust(transfer.accountId, this.config);
    }

    if (transfer?.accountId !== this.expected.recipientAccountId) {
      throw new Error("HEDERA_POLICY_RECIPIENT_MISMATCH");
    }

    if (this.planPolicy?.maxPaymentPerRequest && Number(transfer.amount) > this.planPolicy.maxPaymentAmount) {
      throw new Error("HEDERA_PAYMENT_AMOUNT_EXCEEDS_PLAN_MAX");
    }

    if (!this.planPolicy && Number(transfer.amount) > this.config.maxPaymentHbar) {
      throw new Error("HEDERA_PAYMENT_AMOUNT_EXCEEDS_MAX");
    }

    if (Number(transfer.amount) !== this.expected.amountHbar) {
      throw new Error("HEDERA_POLICY_AMOUNT_MISMATCH");
    }

    if (raw.transactionMemo !== this.expected.transactionMemo) {
      throw new Error("HEDERA_POLICY_MEMO_MISMATCH");
    }

    if (this.businessEvaluationAttestation) {
      if (transfer?.accountId !== this.businessEvaluationAttestation.walletId) {
        throw new Error("BUSINESS_EVALUATION_WALLET_MISMATCH");
      }

      if (Number(transfer.amount) !== this.businessEvaluationAttestation.amount) {
        throw new Error("BUSINESS_EVALUATION_AMOUNT_MISMATCH");
      }
    }

    if (
      this.paymentIntent &&
      this.paymentIntentStore &&
      this.planPolicy?.duplicatePaymentPrevention !== false &&
      !this.reservationAttempted
    ) {
      this.reservationAttempted = true;
      const reservation = await this.paymentIntentStore.reserveIntent(this.paymentIntent);
      if (!reservation.allowed) {
        throw new Error(reservation.reasonCode ?? "DUPLICATE_PAYMENT_BLOCKED");
      }
    }
  }
}

export function parseHederaTransactionId(rawResponse: string): string {
  const match = rawResponse.match(/Transaction ID:\s*(0\.0\.\d+@\d+\.\d+)/i);
  if (!match?.[1]) {
    throw new Error("HEDERA_TRANSACTION_ID_NOT_FOUND");
  }

  return match[1];
}

function buildHashscanTestnetTransactionUrl(transactionId: string): string {
  return `https://hashscan.io/testnet/transaction/${encodeURIComponent(transactionId)}`;
}

function parsePositiveNumber(rawValue: string | undefined, defaultValue: number, errorCode: string): number {
  const value = rawValue === undefined || rawValue.trim() === "" ? defaultValue : Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(errorCode);
  }

  return value;
}

function requireConfigValue(value: string | undefined, errorCode: string): string {
  if (!value) {
    throw new Error(errorCode);
  }

  return value;
}

function cleanOptional(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function splitCsv(value: string | undefined): string[] {
  return value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
}

function sanitizeMemoPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._:-]+/g, "_").slice(0, 60);
}

function validateRecipientTrust(walletId: string, config: HederaSettlementConfig): void {
  if (config.blockedRecipientAccountIds.includes(walletId)) {
    throw new Error("RECIPIENT_WALLET_BLOCKED");
  }

  if (config.allowedRecipientAccountIds.length > 0 && !config.allowedRecipientAccountIds.includes(walletId)) {
    throw new Error("RECIPIENT_WALLET_NOT_ALLOWED");
  }
}

function toErrorCode(error: unknown): string {
  return error instanceof Error ? error.message : "HEDERA_PAYMENT_EXECUTION_FAILED";
}
