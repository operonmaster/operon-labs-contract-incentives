import { NextResponse } from "next/server";
import { umReferenceDataStore } from "../../../../lib/um-reference-data";

export async function GET() {
  return NextResponse.json({ patients: await umReferenceDataStore.listPatients() });
}
