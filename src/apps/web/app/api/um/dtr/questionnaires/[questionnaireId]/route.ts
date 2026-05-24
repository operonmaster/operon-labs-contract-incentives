import { getDtrQuestionnaire } from "@operon-labs/um-platform";
import { NextResponse } from "next/server";

export async function GET(_request: Request, context: { params: Promise<{ questionnaireId: string }> }) {
  const { questionnaireId } = await context.params;
  const questionnaire = getDtrQuestionnaire(questionnaireId);

  if (!questionnaire) {
    return NextResponse.json({ error: "DTR_QUESTIONNAIRE_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ questionnaire });
}
