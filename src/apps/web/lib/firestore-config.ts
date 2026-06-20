export interface FirestoreRuntimeEnv {
  [key: string]: string | undefined;
  GCP_PROJECT_ID?: string;
  GOOGLE_CLOUD_PROJECT?: string;
  FIRESTORE_DATABASE_ID?: string;
}

export interface FirestoreRuntimeConfig {
  projectId: string;
  databaseId: string;
}

export const DEFAULT_FIRESTORE_DATABASE_ID = "(default)";

export function resolveFirestoreConfig(env: FirestoreRuntimeEnv): FirestoreRuntimeConfig {
  const projectId = env.GCP_PROJECT_ID?.trim() || env.GOOGLE_CLOUD_PROJECT?.trim();

  if (!projectId) {
    throw new Error("GCP_PROJECT_ID_REQUIRED");
  }

  return {
    projectId,
    databaseId: env.FIRESTORE_DATABASE_ID?.trim() || DEFAULT_FIRESTORE_DATABASE_ID
  };
}
