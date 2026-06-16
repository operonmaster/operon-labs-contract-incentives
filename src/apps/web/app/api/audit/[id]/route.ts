import { NextResponse } from "next/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  return NextResponse.json({
    id,
    status: "demo-placeholder",
    message: "Audit persistence will be added after the hosted demo flow is complete."
  });
}
