import type { ProviderDocumentationEvidence, RequestType, UMRequest } from "./index";

export type PasFhirResource =
  | PasFhirClaim
  | PasFhirPatient
  | PasFhirOrganization
  | PasFhirCoverage;

export interface PasFhirBundle {
  resourceType: "Bundle";
  id: string;
  type: "collection";
  timestamp: string;
  entry: Array<{
    fullUrl: string;
    resource: PasFhirResource;
  }>;
}

export interface PasFhirClaim {
  resourceType: "Claim";
  id: string;
  status: "active";
  use: "preauthorization";
  created: string;
  identifier: Array<{
    system: string;
    value: string;
  }>;
  patient: FhirReference;
  provider: FhirReference;
  insurer: FhirReference;
  insurance: Array<{
    sequence: number;
    focal: boolean;
    coverage: FhirReference;
  }>;
  item: Array<{
    sequence: number;
    category: FhirCodeableConcept;
    productOrService: FhirCodeableConcept;
  }>;
  supportingInfo: Array<{
    sequence: number;
    category: FhirCodeableConcept;
    valueBoolean?: boolean;
    valueString?: string;
  }>;
}

export interface PasFhirPatient {
  resourceType: "Patient";
  id: string;
  identifier: Array<{
    system: string;
    value: string;
  }>;
  name: Array<{
    text: string;
  }>;
}

export interface PasFhirOrganization {
  resourceType: "Organization";
  id: string;
  name: string;
  type?: Array<FhirCodeableConcept>;
}

export interface PasFhirCoverage {
  resourceType: "Coverage";
  id: string;
  status: "active";
  beneficiary: FhirReference;
  payor: FhirReference[];
}

interface FhirReference {
  reference: string;
  display?: string;
}

interface FhirCodeableConcept {
  coding?: Array<{
    system: string;
    code: string;
    display?: string;
  }>;
  text?: string;
}

export function buildPasFhirBundle(umRequest: UMRequest, evidence: ProviderDocumentationEvidence): PasFhirBundle {
  const patientReference = `Patient/${umRequest.patientId}`;
  const providerReference = `Organization/${umRequest.providerId}`;
  const insurerReference = `Organization/${umRequest.planId}`;
  const coverageReference = `Coverage/coverage-${umRequest.id}`;
  const claim: PasFhirClaim = {
    resourceType: "Claim",
    id: umRequest.id,
    status: "active",
    use: "preauthorization",
    created: umRequest.submittedAt,
    identifier: [
      {
        system: "https://operon.cloud/fhir/NamingSystem/prior-auth-case-id",
        value: umRequest.id
      },
      {
        system: "https://operon.cloud/fhir/NamingSystem/um-request-id",
        value: umRequest.id
      }
    ],
    patient: {
      reference: patientReference,
      display: umRequest.patientDisplay
    },
    provider: {
      reference: providerReference,
      display: umRequest.providerDisplay
    },
    insurer: {
      reference: insurerReference,
      display: umRequest.planDisplay
    },
    insurance: [
      {
        sequence: 1,
        focal: true,
        coverage: {
          reference: coverageReference
        }
      }
    ],
    item: [
      {
        sequence: 1,
        category: requestTypeConcept(umRequest.requestType),
        productOrService: {
          coding: [
            {
              system: codingSystemUri(umRequest.codingSystem),
              code: umRequest.billingCode,
              display: umRequest.serviceLabel
            }
          ],
          text: umRequest.serviceLabel
        }
      }
    ],
    supportingInfo: [
      booleanSupportingInfo(1, "crd-coverage-checked", "Coverage checked", evidence.crdCoverageChecked),
      booleanSupportingInfo(2, "crd-covered-benefit", "Covered benefit", evidence.crdCoveredBenefit),
      booleanSupportingInfo(3, "dtr-template-completed", "DTR template completed", evidence.dtrTemplateCompleted),
      booleanSupportingInfo(4, "attachment-checklist-complete", "Attachment checklist complete", evidence.attachmentChecklistComplete),
      booleanSupportingInfo(5, "required-fhir-fields-present", "Required FHIR fields present", evidence.fhirFieldsPresent),
      booleanSupportingInfo(6, "pas-submitted", "PAS submitted", true),
      stringSupportingInfo(7, "um-request-state", "UM request state", umRequest.state),
      stringSupportingInfo(8, "outcome-status", "Outcome status", umRequest.outcomeStatus ?? "none")
    ]
  };

  return {
    resourceType: "Bundle",
    id: umRequest.id,
    type: "collection",
    timestamp: umRequest.submittedAt,
    entry: buildEntries(claim, umRequest, patientReference, providerReference, insurerReference, coverageReference)
  };
}

function buildEntries(
  claim: PasFhirClaim,
  umRequest: UMRequest,
  patientReference: string,
  providerReference: string,
  insurerReference: string,
  coverageReference: string
): PasFhirBundle["entry"] {
  const entries: PasFhirBundle["entry"] = [
    {
      fullUrl: `urn:uuid:claim-${umRequest.id}`,
      resource: claim
    },
    {
      fullUrl: `urn:uuid:${umRequest.patientId}`,
      resource: {
        resourceType: "Patient",
        id: umRequest.patientId,
        identifier: [
          {
            system: "https://operon.cloud/fhir/NamingSystem/synthetic-patient-id",
            value: umRequest.patientId
          }
        ],
        name: [
          {
            text: umRequest.patientDisplay
          }
        ]
      }
    },
    {
      fullUrl: `urn:uuid:${umRequest.providerId}`,
      resource: {
        resourceType: "Organization",
        id: umRequest.providerId,
        name: umRequest.providerDisplay,
        type: [
          {
            text: "Provider administrative submitter"
          }
        ]
      }
    },
    {
      fullUrl: `urn:uuid:${umRequest.planId}`,
      resource: {
        resourceType: "Organization",
        id: umRequest.planId,
        name: umRequest.planDisplay,
        type: [
          {
            text: "Health plan"
          }
        ]
      }
    },
    {
      fullUrl: `urn:uuid:coverage-${umRequest.id}`,
      resource: {
        resourceType: "Coverage",
        id: `coverage-${umRequest.id}`,
        status: "active",
        beneficiary: {
          reference: patientReference
        },
        payor: [
          {
            reference: insurerReference,
            display: umRequest.planDisplay
          }
        ]
      }
    }
  ];

  return entries;
}

function requestTypeConcept(requestType: RequestType): FhirCodeableConcept {
  return {
    coding: [
      {
        system: "https://operon.cloud/fhir/CodeSystem/prior-auth-request-type",
        code: requestType,
        display: requestTypeDisplay(requestType)
      }
    ],
    text: requestTypeDisplay(requestType)
  };
}

function booleanSupportingInfo(sequence: number, code: string, display: string, valueBoolean: boolean) {
  return {
    sequence,
    category: supportingInfoCategory(code, display),
    valueBoolean
  };
}

function stringSupportingInfo(sequence: number, code: string, display: string, valueString: string) {
  return {
    sequence,
    category: supportingInfoCategory(code, display),
    valueString
  };
}

function supportingInfoCategory(code: string, display: string): FhirCodeableConcept {
  return {
    coding: [
      {
        system: "https://operon.cloud/fhir/CodeSystem/pas-supporting-info",
        code,
        display
      }
    ],
    text: display
  };
}

function codingSystemUri(codingSystem: UMRequest["codingSystem"]): string {
  switch (codingSystem) {
    case "CPT":
      return "http://www.ama-assn.org/go/cpt";
    case "NDC":
      return "http://hl7.org/fhir/sid/ndc";
  }
}

function requestTypeDisplay(requestType: RequestType): string {
  switch (requestType) {
    case "outpatient_service":
      return "Outpatient Service";
    case "pharmacy_benefit":
      return "Pharmacy Benefit";
    case "inpatient_admission":
      return "Inpatient Admission";
  }
}
