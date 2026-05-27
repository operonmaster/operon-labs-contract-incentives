#!/usr/bin/env node
import { Firestore } from "@google-cloud/firestore";

const DEFAULT_PROJECT_ID = "operon-labs-nonprod";
const DEFAULT_DATABASE_ID = "(default)";
const PURGE_COLLECTIONS = [
  "umRequests",
  "pasClaims",
  "auditEvents",
  "incentiveEvaluations",
  "paymentPolicyEvidences",
  "paymentIntents"
];
const PRESERVED_COLLECTIONS = [
  "incentivePolicies",
  "paymentPolicies",
  "patients",
  "coverageRequirementRules",
  "questionnaires"
];
const BATCH_LIMIT = 450;

const args = parseArgs(process.argv.slice(2));
const projectId =
  args.projectId ??
  process.env.GCP_PROJECT_ID ??
  process.env.GOOGLE_CLOUD_PROJECT ??
  process.env.GCLOUD_PROJECT ??
  DEFAULT_PROJECT_ID;
const databaseId = args.databaseId ?? process.env.FIRESTORE_DATABASE_ID ?? DEFAULT_DATABASE_ID;

if (args.help) {
  printUsage();
  process.exit(0);
}

printTarget(projectId, databaseId);

if (args.dryRun) {
  console.log("Mode: dry run; no documents will be deleted.");
} else if (!args.confirm) {
  console.error("Refusing to purge without --confirm. Use --dry-run to inspect the target.");
  process.exit(1);
} else {
  console.log("Mode: confirmed live deletion.");
}

const firestore = new Firestore({ projectId, databaseId });

for (const collectionName of PURGE_COLLECTIONS) {
  const snapshot = await firestore.collection(collectionName).get();
  console.log(`${collectionName}: ${snapshot.size} document(s)`);

  if (args.dryRun || snapshot.empty) {
    continue;
  }

  let batch = firestore.batch();
  let pendingWrites = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    pendingWrites += 1;

    if (pendingWrites === BATCH_LIMIT) {
      await batch.commit();
      batch = firestore.batch();
      pendingWrites = 0;
    }
  }

  if (pendingWrites > 0) {
    await batch.commit();
  }
}

console.log(args.dryRun ? "Dry run complete." : "Purge complete.");

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
  console.log(`Collections to purge: ${PURGE_COLLECTIONS.join(", ")}`);
  console.log(`Collections preserved: ${PRESERVED_COLLECTIONS.join(", ")} and other reference data`);
}

function printUsage() {
  console.log(`Usage:
  node scripts/purge-demo-settlement-state.mjs --dry-run
  node scripts/purge-demo-settlement-state.mjs --confirm

Options:
  --dry-run              Print the target and document counts without deleting.
  --confirm              Required for live deletion.
  --project-id=<id>      Override GCP project. Defaults to GCP_PROJECT_ID, GOOGLE_CLOUD_PROJECT, GCLOUD_PROJECT, or ${DEFAULT_PROJECT_ID}.
  --database-id=<id>     Override Firestore database. Defaults to FIRESTORE_DATABASE_ID or ${DEFAULT_DATABASE_ID}.

Only these top-level collections are eligible for deletion:
  ${PURGE_COLLECTIONS.join(", ")}

The script never deletes incentivePolicies, paymentPolicies, or reference-data collections.`);
}
