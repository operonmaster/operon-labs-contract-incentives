import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "POLICY_AUTO_SETTLEMENT_ENABLED" }, { status: 410 });
}
