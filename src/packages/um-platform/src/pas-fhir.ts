import type { PriorAuthRecord, ProviderDocumentationEvidence, RequestType } from "./index";

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

export function buildPasFhirBundle(record: PriorAuthRecord, evidence: ProviderDocumentationEvidence): PasFhirBundle {
  const patientReference = `Patient/${record.patientId}`;
  const providerReference = `Organization/${record.providerGroupId}`;
  const insurerReference = `Organization/${record.planId}`;
  const coverageReference = `Coverage/coverage-${record.caseId}`;
  const claim: PasFhirClaim = {
    resourceType: "Claim",
    id: `claim-${record.caseId}`,
    status: "active",
    use: "preauthorization",
    created: record.submittedAt,
    identifier: [
      {
        system: "https://operon.cloud/fhir/NamingSystem/prior-auth-case-id",
        value: record.caseId
      }
    ],
    patient: {
      reference: patientReference,
      display: record.patientDisplay
    },
    provider: {
      reference: providerReference,
      display: record.providerGroupDisplay
    },
    insurer: {
      reference: insurerReference,
      display: record.planDisplay
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
        category: requestTypeConcept(record.requestType),
        productOrService: {
          coding: [
            {
              system: codingSystemUri(record.codingSystem),
              code: record.billingCode,
              display: record.serviceLabel
            }
          ],
          text: record.serviceLabel
        }
      }
    ],
    supportingInfo: [
      booleanSupportingInfo(1, "crd-coverage-checked", "Coverage checked", evidence.crdCoverageChecked),
      booleanSupportingInfo(2, "crd-covered-benefit", "Covered benefit", evidence.crdCoveredBenefit),
      booleanSupportingInfo(3, "dtr-template-completed", "DTR template completed", evidence.dtrTemplateCompleted),
      booleanSupportingInfo(4, "attachment-checklist-complete", "Attachment checklist complete", evidence.attachmentChecklistComplete),
      booleanSupportingInfo(5, "required-fhir-fields-present", "Required FHIR fields present", evidence.fhirFieldsPresent),
      booleanSupportingInfo(6, "pas-submitted", "PAS submitted", evidence.pasSubmitted),
      stringSupportingInfo(7, "pa-result", "PA result", record.paResult),
      stringSupportingInfo(8, "denial-reason", "Denial reason", record.denialReason ?? "none")
    ]
  };

  const entries: PasFhirBundle["entry"] = [
    {
      fullUrl: `urn:uuid:claim-${record.caseId}`,
      resource: claim
    },
    {
      fullUrl: `urn:uuid:${record.patientId}`,
      resource: {
        resourceType: "Patient",
        id: record.patientId,
        identifier: [
          {
            system: "https://operon.cloud/fhir/NamingSystem/synthetic-patient-id",
            value: record.patientId
          }
        ],
        name: [
          {
            text: record.patientDisplay
          }
        ]
      }
    },
    {
      fullUrl: `urn:uuid:${record.providerGroupId}`,
      resource: {
        resourceType: "Organization",
        id: record.providerGroupId,
        name: record.providerGroupDisplay,
        type: [
          {
            text: "Provider administrative submitter"
          }
        ]
      }
    },
    {
      fullUrl: `urn:uuid:${record.planId}`,
      resource: {
        resourceType: "Organization",
        id: record.planId,
        name: record.planDisplay,
        type: [
          {
            text: "Health plan"
          }
        ]
      }
    },
    {
      fullUrl: `urn:uuid:coverage-${record.caseId}`,
      resource: {
        resourceType: "Coverage",
        id: `coverage-${record.caseId}`,
        status: "active",
        beneficiary: {
          reference: patientReference
        },
        payor: [
          {
            reference: insurerReference,
            display: record.planDisplay
          }
        ]
      }
    }
  ];

  return {
    resourceType: "Bundle",
    id: `pas-${record.caseId}`,
    type: "collection",
    timestamp: record.submittedAt,
    entry: entries
  };
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

function codingSystemUri(codingSystem: PriorAuthRecord["codingSystem"]): string {
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
