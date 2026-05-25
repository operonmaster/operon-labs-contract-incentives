import { AgentMode, HederaAgentAPI, AbstractHook, type Context, type PreToolExecutionParams } from "@hashgraph/hedera-agent-kit";
import { coreAccountPlugin, coreAccountPluginToolNames } from "@hashgraph/hedera-agent-kit/plugins";
import { Client, PrivateKey } from "@hiero-ledger/sdk";
import type { Currency } from "@operon-labs/policy-engine";

export interface PaymentApprovalRequest {
  auditId: string;
  caseId?: string;
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
  maxPaymentHbar: number;
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
  runHbarTransfer(input: HederaHbarTransferInput, config: HederaSettlementConfig): Promise<HederaHbarTransferOutput>;
}

export interface ExecutePolicyBoundPaymentOptions {
  config?: HederaSettlementConfig;
  runner?: HederaAgentKitTransferRunner;
}

export interface PaymentExecutionResult {
  status: "simulated" | "submitted";
  network: "testnet";
  transactionId: string;
  runtime: "hedera-agent-kit-policy";
  rawResponse?: string;
  explorerUrl?: string;
}

export const hederaAgentKitPolicyRuntime = {
  packageName: "@hashgraph/hedera-agent-kit",
  mode: "AUTONOMOUS",
  allowedTools: [coreAccountPluginToolNames.TRANSFER_HBAR_TOOL],
  hookStages: ["pre-tool execution", "post-parameter normalization", "post-core action", "post-tool execution"],
  settlementModel: "pre_authorized_policy_auto_settlement"
} as const;

const DEFAULT_MAX_PAYMENT_HBAR = 5;
const HEDERA_TRANSACTION_MEMO_LIMIT = 100;
const TRANSFER_HBAR_TOOL = coreAccountPluginToolNames.TRANSFER_HBAR_TOOL;

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
  const operatorAccountId = cleanOptional(env.HEDERA_OPERATOR_ACCOUNT_ID);
  const operatorPrivateKey = cleanOptional(env.HEDERA_OPERATOR_PRIVATE_KEY);

  if (rawMode === "real") {
    if (!operatorAccountId) {
      throw new Error("HEDERA_OPERATOR_ACCOUNT_ID_REQUIRED");
    }
    if (!operatorPrivateKey) {
      throw new Error("HEDERA_OPERATOR_PRIVATE_KEY_REQUIRED");
    }
    if (allowedRecipientAccountIds.length === 0) {
      throw new Error("HEDERA_ALLOWED_RECIPIENT_ACCOUNT_IDS_REQUIRED");
    }
  }

  return {
    mode: rawMode,
    network: rawNetwork,
    operatorAccountId,
    operatorPrivateKey,
    allowedRecipientAccountIds,
    maxPaymentHbar
  };
}

export async function executePolicyBoundPayment(
  request: PaymentApprovalRequest,
  options: ExecutePolicyBoundPaymentOptions = {}
): Promise<PaymentExecutionResult> {
  const config = options.config ?? createHederaSettlementConfigFromEnv();
  validatePolicyBoundPayment(request, config);

  if (config.mode === "simulated") {
    const transactionId = `testnet-${request.auditId}-${request.currency.toLowerCase()}-${Date.now()}`;
    return {
      status: "simulated",
      network: config.network,
      transactionId,
      runtime: "hedera-agent-kit-policy",
      rawResponse: "Explicit simulated settlement mode. No Hedera transaction was submitted."
    };
  }

  const sourceAccountId = requireConfigValue(config.operatorAccountId, "HEDERA_OPERATOR_ACCOUNT_ID_REQUIRED");
  const runner = options.runner ?? new DefaultHederaAgentKitTransferRunner();
  const transfer = await runner.runHbarTransfer(
    {
      sourceAccountId,
      recipientAccountId: request.walletId,
      amountHbar: request.amount,
      transactionMemo: buildHederaTransactionMemo(request)
    },
    config
  );

  return {
    status: "submitted",
    network: config.network,
    transactionId: transfer.transactionId,
    runtime: "hedera-agent-kit-policy",
    rawResponse: transfer.rawResponse,
    explorerUrl: buildHashscanTestnetTransactionUrl(transfer.transactionId)
  };
}

export const executeApprovedPayment = executePolicyBoundPayment;

export function buildHederaTransactionMemo(request: PaymentApprovalRequest): string {
  const caseOrAudit = sanitizeMemoPart(request.caseId ?? request.auditId);
  const policyId = sanitizeMemoPart(request.policyId ?? "policy");
  const event = sanitizeMemoPart(request.triggerEvent ?? "event");
  const memo = `olabs|case:${caseOrAudit}|policy:${policyId}|event:${event}`;

  return memo.length > HEDERA_TRANSACTION_MEMO_LIMIT ? memo.slice(0, HEDERA_TRANSACTION_MEMO_LIMIT) : memo;
}

function validatePolicyBoundPayment(request: PaymentApprovalRequest, config: HederaSettlementConfig): void {
  if (request.currency !== "HBAR") {
    throw new Error("HEDERA_TOKEN_TRANSFER_NOT_IMPLEMENTED");
  }

  if (!Number.isFinite(request.amount) || request.amount <= 0) {
    throw new Error("INVALID_HEDERA_PAYMENT_AMOUNT");
  }

  if (request.amount > config.maxPaymentHbar) {
    throw new Error("HEDERA_PAYMENT_AMOUNT_EXCEEDS_MAX");
  }

  if (config.allowedRecipientAccountIds.length > 0 && !config.allowedRecipientAccountIds.includes(request.walletId)) {
    throw new Error("RECIPIENT_WALLET_NOT_ALLOWED");
  }

  if (!request.walletId || !/^0\.0\.\d+$/.test(request.walletId)) {
    throw new Error("INVALID_RECIPIENT_WALLET_ID");
  }
}

class DefaultHederaAgentKitTransferRunner implements HederaAgentKitTransferRunner {
  async runHbarTransfer(input: HederaHbarTransferInput, config: HederaSettlementConfig): Promise<HederaHbarTransferOutput> {
    const operatorAccountId = requireConfigValue(config.operatorAccountId, "HEDERA_OPERATOR_ACCOUNT_ID_REQUIRED");
    const operatorPrivateKey = requireConfigValue(config.operatorPrivateKey, "HEDERA_OPERATOR_PRIVATE_KEY_REQUIRED");
    const client = Client.forTestnet().setOperator(operatorAccountId, PrivateKey.fromString(operatorPrivateKey));
    const context: Context = {
      accountId: operatorAccountId,
      mode: AgentMode.AUTONOMOUS,
      hooks: [new PolicyBoundHbarTransferHook(input)]
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

class PolicyBoundHbarTransferHook extends AbstractHook {
  name = "operon-policy-bound-hbar-transfer";
  description = "Blocks Hedera HBAR transfers that do not match the evaluated Operon Labs incentive policy result.";
  relevantTools = [TRANSFER_HBAR_TOOL];

  constructor(private readonly expected: HederaHbarTransferInput) {
    super();
  }

  async preToolExecutionHook(params: PreToolExecutionParams, method: string): Promise<void> {
    if (method !== TRANSFER_HBAR_TOOL) {
      throw new Error("HEDERA_TOOL_NOT_ALLOWED");
    }

    const raw = params.rawParams as
      | {
          transfers?: Array<{ accountId?: string; amount?: number }>;
          transactionMemo?: string;
        }
      | undefined;

    if (!raw || !Array.isArray(raw.transfers) || raw.transfers.length !== 1) {
      throw new Error("HEDERA_POLICY_REQUIRES_SINGLE_RECIPIENT");
    }

    const [transfer] = raw.transfers;
    if (transfer?.accountId !== this.expected.recipientAccountId) {
      throw new Error("HEDERA_POLICY_RECIPIENT_MISMATCH");
    }

    if (Number(transfer.amount) !== this.expected.amountHbar) {
      throw new Error("HEDERA_POLICY_AMOUNT_MISMATCH");
    }

    if (raw.transactionMemo !== this.expected.transactionMemo) {
      throw new Error("HEDERA_POLICY_MEMO_MISMATCH");
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
