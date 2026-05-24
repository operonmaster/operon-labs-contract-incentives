import { getCoverageRequirements, type RequestType, type ServiceCode } from "@operon-labs/um-platform";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestType = url.searchParams.get("requestType");
  const serviceCode = url.searchParams.get("serviceCode");

  if (!isRequestType(requestType) || !isServiceCode(serviceCode)) {
    return NextResponse.json({ error: "INVALID_CRD_REQUIREMENTS_REQUEST" }, { status: 400 });
  }

  const requirements = getCoverageRequirements(serviceCode);
  if (requirements.requestType !== requestType) {
    return NextResponse.json({ error: "REQUEST_TYPE_SERVICE_MISMATCH" }, { status: 400 });
  }

  return NextResponse.json({ requirements });
}

function isRequestType(value: string | null): value is Exclude<RequestType, "inpatient_admission"> {
  return value === "outpatient_service" || value === "pharmacy_benefit";
}

function isServiceCode(value: string | null): value is ServiceCode {
  return (
    value === "knee_mri" ||
    value === "full_body_wellness_mri" ||
    value === "wegovy_semaglutide" ||
    value === "humira_adalimumab"
  );
}
