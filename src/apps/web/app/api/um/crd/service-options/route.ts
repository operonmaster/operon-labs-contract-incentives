import { getCrdServiceOptions } from "@operon-labs/um-platform";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ services: getCrdServiceOptions() });
}
