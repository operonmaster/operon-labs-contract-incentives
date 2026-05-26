import { NextResponse } from "next/server";

export async function POST(request: Request) {
  await request.body?.cancel().catch(() => undefined);
  return NextResponse.json({ error: "PAYMENT_APPROVAL_ROUTE_DISABLED" }, { status: 410 });
}
