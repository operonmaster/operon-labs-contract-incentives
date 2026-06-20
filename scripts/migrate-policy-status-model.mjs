#!/usr/bin/env node
import { Firestore } from "@google-cloud/firestore";

const DEFAULT_DATABASE_ID = "(default)";
const STATUS_COLLECTIONS = ["incentiveEvaluations", "paymentPolicyEvidences"];

const args = parseArgs(process.argv.slice(2));
const projectId =
  args.projectId ??
  process.env.GCP_PROJECT_ID ??
  process.env.GOOGLE_CLOUD_PROJECT ??
  process.env.GCLOUD_PROJECT;
const databaseId = args.databaseId ?? process.env.FIRESTORE_DATABASE_ID ?? DEFAULT_DATABASE_ID;

if (args.help) {
  printUsage();
  process.exit(0);
}

if (!projectId) {
  console.error("GCP_PROJECT_ID_REQUIRED: pass --project-id or set GCP_PROJECT_ID, GOOGLE_CLOUD_PROJECT, or GCLOUD_PROJECT.");
  process.exit(1);
}

printTarget(projectId, databaseId);

if (args.dryRun) {
  console.log("Mode: dry run; no documents will be updated.");
} else if (!args.confirm) {
  console.error("Refusing to migrate without --confirm. Use --dry-run to inspect the target.");
  process.exit(1);
} else {
  console.log("Mode: confirmed live status migration.");
}

const firestore = new Firestore({ projectId, databaseId });

const incentiveSnapshot = await firestore.collection("incentiveEvaluations").get();
const evidenceSnapshot = await firestore.collection("paymentPolicyEvidences").get();

console.log(`Before: incentiveEvaluations=${incentiveSnapshot.size}, paymentPolicyEvidences=${evidenceSnapshot.size}`);

const incentivePatches = incentiveSnapshot.docs.map((doc) => {
  const data = doc.data();
  return {
    ref: doc.ref,
    id: doc.id,
    patch: {
      businessPolicyStatus: deriveBusinessPolicyStatus(data.incentiveStatus),
      paymentPolicyStatus: derivePaymentPolicyStatus(data),
      updatedAt: new Date().toISOString()
    }
  };
});

const unknownEvidenceOutcomes = [];
const evidencePatches = [];

for (const doc of evidenceSnapshot.docs) {
  const data = doc.data();
  const outcome = derivePaymentEvidenceOutcome(data.outcome);

  if (outcome === null) {
    unknownEvidenceOutcomes.push({
      id: doc.id,
      outcome: data.outcome
    });
    continue;
  }

  const patch = {
    outcome,
    updatedAt: new Date().toISOString()
  };

  if (data.outcome === "simulated") {
    patch.runtimeMode = "simulated";
  }

  evidencePatches.push({
    ref: doc.ref,
    id: doc.id,
    patch
  });
}

printPlannedCounts("incentiveEvaluations", incentivePatches, summarizeIncentivePatch);
printPlannedCounts("paymentPolicyEvidences", evidencePatches, summarizeEvidencePatch);
printUnknownEvidenceOutcomes(unknownEvidenceOutcomes, args.dryRun ? "skipped" : "found");

if (!args.dryRun && unknownEvidenceOutcomes.length > 0) {
  console.error(
    `Refusing to migrate paymentPolicyEvidences with unknown outcomes: ${unknownEvidenceOutcomes
      .map((item) => `${item.id}=${formatUnknownOutcome(item.outcome)}`)
      .join(", ")}`
  );
  console.error("Run with --dry-run to review, then fix those documents or extend the migration mapping.");
  process.exit(1);
}

if (!args.dryRun) {
  await commitPatches(firestore, [...incentivePatches, ...evidencePatches]);
}

const postIncentiveSnapshot = await firestore.collection("incentiveEvaluations").get();
const postEvidenceSnapshot = await firestore.collection("paymentPolicyEvidences").get();

console.log(`After: incentiveEvaluations=${postIncentiveSnapshot.size}, paymentPolicyEvidences=${postEvidenceSnapshot.size}`);
printPostCounts(postIncentiveSnapshot.docs, postEvidenceSnapshot.docs);
printSampleDocs(postIncentiveSnapshot.docs, postEvidenceSnapshot.docs);
console.log(args.dryRun ? "Dry run complete." : "Policy status migration complete.");

function deriveBusinessPolicyStatus(status) {
  switch (status) {
    case "paid":
    case "payment_failed":
      return "approved";
    case "not_eligible":
      return "rejected";
    default:
      return null;
  }
}

function derivePaymentPolicyStatus(data) {
  switch (data.paymentStatus) {
    case "auto_executed":
      return data.transactionId || data.paymentIntentId ? "paid" : null;
    case "blocked_by_policy":
    case "execution_failed":
      return "blocked";
    default:
      return null;
  }
}

function derivePaymentEvidenceOutcome(outcome) {
  if (outcome === "paid" || outcome === "simulated") {
    return "paid";
  }

  if (outcome === "blocked") {
    return "blocked";
  }

  return null;
}

async function commitPatches(firestore, patches) {
  let batch = firestore.batch();
  let pendingWrites = 0;

  for (const item of patches) {
    batch.set(item.ref, item.patch, { merge: true });
    pendingWrites += 1;

    if (pendingWrites === 450) {
      await batch.commit();
      batch = firestore.batch();
      pendingWrites = 0;
    }
  }

  if (pendingWrites > 0) {
    await batch.commit();
  }
}

function printPlannedCounts(collectionName, patches, summarize) {
  const counts = new Map();
  for (const item of patches) {
    const key = summarize(item.patch);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  console.log(`${collectionName} planned updates: ${patches.length}`);
  for (const [key, count] of [...counts.entries()].sort()) {
    console.log(`  ${key}: ${count}`);
  }
}

function summarizeIncentivePatch(patch) {
  return `businessPolicyStatus=${patch.businessPolicyStatus ?? "null"}, paymentPolicyStatus=${patch.paymentPolicyStatus ?? "null"}`;
}

function summarizeEvidencePatch(patch) {
  return `outcome=${patch.outcome}`;
}

function printUnknownEvidenceOutcomes(unknowns, action) {
  if (unknowns.length === 0) {
    return;
  }

  console.log(`paymentPolicyEvidences unknown outcomes ${action}: ${unknowns.length}`);
  for (const item of unknowns) {
    console.log(`  ${item.id}: outcome=${formatUnknownOutcome(item.outcome)}`);
  }
}

function formatUnknownOutcome(outcome) {
  if (outcome === undefined) {
    return "missing";
  }

  if (outcome === null) {
    return "null";
  }

  if (typeof outcome === "string") {
    return JSON.stringify(outcome);
  }

  try {
    return JSON.stringify(outcome);
  } catch {
    return String(outcome);
  }
}

function printPostCounts(incentiveDocs, evidenceDocs) {
  const incentiveCounts = new Map();
  for (const doc of incentiveDocs) {
    const data = doc.data();
    const key = `businessPolicyStatus=${data.businessPolicyStatus ?? "null"}, paymentPolicyStatus=${data.paymentPolicyStatus ?? "null"}`;
    incentiveCounts.set(key, (incentiveCounts.get(key) ?? 0) + 1);
  }

  const evidenceCounts = new Map();
  for (const doc of evidenceDocs) {
    const data = doc.data();
    const key = `outcome=${data.outcome ?? "null"}`;
    evidenceCounts.set(key, (evidenceCounts.get(key) ?? 0) + 1);
  }

  console.log("Post-migration status counts:");
  for (const [key, count] of [...incentiveCounts.entries()].sort()) {
    console.log(`  incentiveEvaluations ${key}: ${count}`);
  }
  for (const [key, count] of [...evidenceCounts.entries()].sort()) {
    console.log(`  paymentPolicyEvidences ${key}: ${count}`);
  }
}

function printSampleDocs(incentiveDocs, evidenceDocs) {
  const sampleIncentiveDocs = incentiveDocs.slice(0, 5).map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      umRequestId: data.umRequestId,
      businessPolicyStatus: data.businessPolicyStatus ?? null,
      paymentPolicyStatus: data.paymentPolicyStatus ?? null,
      incentiveStatus: data.incentiveStatus ?? null,
      paymentStatus: data.paymentStatus ?? null
    };
  });
  const sampleEvidenceDocs = evidenceDocs.slice(0, 5).map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      umRequestId: data.umRequestId,
      outcome: data.outcome ?? null,
      runtimeMode: data.runtimeMode ?? null
    };
  });

  console.log("Sample incentiveEvaluations:");
  console.log(JSON.stringify(sampleIncentiveDocs, null, 2));
  console.log("Sample paymentPolicyEvidences:");
  console.log(JSON.stringify(sampleEvidenceDocs, null, 2));
}

function parseArgs(argv) {
  const parsed = {
    confirm: false,
    dryRun: false,
    help: false,
    projectId: undefined,
    databaseId: undefined
  };

  for (const arg of argv) {
    if (arg === "--confirm") {
      parsed.confirm = true;
      continue;
    }
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg.startsWith("--project-id=")) {
      parsed.projectId = readOptionValue(arg, "--project-id");
      continue;
    }
    if (arg.startsWith("--database-id=")) {
      parsed.databaseId = readOptionValue(arg, "--database-id");
      continue;
    }

    console.error(`Unknown argument: ${arg}`);
    printUsage();
    process.exit(1);
  }

  return parsed;
}

function readOptionValue(arg, name) {
  const value = arg.slice(`${name}=`.length).trim();
  if (!value) {
    console.error(`${name} requires a non-empty value.`);
    process.exit(1);
  }
  return value;
}

function printTarget(projectId, databaseId) {
  console.log(`Project: ${projectId}`);
  console.log(`Database: ${databaseId}`);
  console.log(`Collections to update: ${STATUS_COLLECTIONS.join(", ")}`);
  console.log("Collections preserved: paymentIntents lifecycle status and all policy/reference collections");
}

function printUsage() {
  console.log(`Usage:
  node scripts/migrate-policy-status-model.mjs --dry-run
  node scripts/migrate-policy-status-model.mjs --confirm

Options:
  --dry-run              Print the target, counts, planned updates, and samples without updating.
  --confirm              Required for live status migration.
  --project-id=<id>      GCP project. Defaults to GCP_PROJECT_ID, GOOGLE_CLOUD_PROJECT, or GCLOUD_PROJECT.
  --database-id=<id>     Override Firestore database. Defaults to FIRESTORE_DATABASE_ID or ${DEFAULT_DATABASE_ID}.

Only these top-level collections are updated:
  ${STATUS_COLLECTIONS.join(", ")}

The script does not mutate paymentIntents.status because that field is execution lifecycle state.`);
}
