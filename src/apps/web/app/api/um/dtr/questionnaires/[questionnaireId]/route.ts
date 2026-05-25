import { NextResponse } from "next/server";
import { umReferenceDataStore } from "../../../../../../lib/um-reference-data";

export async function GET(_request: Request, context: { params: Promise<{ questionnaireId: string }> }) {
  const { questionnaireId } = await context.params;
  const questionnaire = await umReferenceDataStore.getDtrQuestionnaire(questionnaireId);

  if (!questionnaire) {
    return NextResponse.json({ error: "DTR_QUESTIONNAIRE_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ questionnaire });
}
