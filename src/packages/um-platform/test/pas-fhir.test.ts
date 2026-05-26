import { describe, expect, it } from "vitest";
import { buildPasFhirBundle, createInMemoryUmPlatform } from "../src/index";

describe("PAS FHIR Bundle mapping", () => {
  it("maps an outpatient service prior authorization to a preauthorization Claim with CPT coding", () => {
    const platform = createInMemoryUmPlatform();
    const umRequest = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const evidence = platform.getEvidence(umRequest.id);

    const bundle = buildPasFhirBundle(umRequest, evidence!);
    const claim = bundle.entry.find((entry) => entry.resource.resourceType === "Claim")?.resource;

    expect(bundle).toMatchObject({
      resourceType: "Bundle",
      id: umRequest.id,
      type: "collection"
    });
    expect(claim).toMatchObject({
      resourceType: "Claim",
      id: umRequest.id,
      status: "active",
      use: "preauthorization",
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
      patient: { reference: "Patient/patient-maya-chen" },
      provider: { reference: "Organization/lakeside-provider-admin" },
      insurer: { reference: "Organization/acme-health-ppo" },
      item: [
        {
          sequence: 1,
          productOrService: {
            coding: [
              {
                system: "http://www.ama-assn.org/go/cpt",
                code: "73721",
                display: "Knee MRI after injury"
              }
            ]
          },
          category: {
            coding: [
              {
                system: "https://operon.cloud/fhir/CodeSystem/prior-auth-request-type",
                code: "outpatient_service",
                display: "Outpatient Service"
              }
            ]
          }
        }
      ]
    });
    expect(claim).toMatchObject({
      supportingInfo: expect.arrayContaining([
        expect.objectContaining({ category: expect.objectContaining({ text: "Coverage checked" }), valueBoolean: true }),
        expect.objectContaining({ category: expect.objectContaining({ text: "DTR template completed" }), valueBoolean: true }),
        expect.objectContaining({ category: expect.objectContaining({ text: "PAS submitted" }), valueBoolean: true })
      ])
    });
  });

  it("maps a pharmacy benefit prior authorization to NDC-coded Claim item", () => {
    const platform = createInMemoryUmPlatform();
    const umRequest = platform.submitPriorAuth({
      patientId: "patient-andre-williams",
      patientDisplay: "Andre Williams",
      planId: "summit-health-hmo",
      planDisplay: "Summit Health HMO",
      requestType: "pharmacy_benefit",
      serviceCode: "wegovy_semaglutide",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const evidence = platform.getEvidence(umRequest.id);

    const bundle = buildPasFhirBundle(umRequest, evidence!);
    const claim = bundle.entry.find((entry) => entry.resource.resourceType === "Claim")?.resource;

    expect(claim).toMatchObject({
      resourceType: "Claim",
      use: "preauthorization",
      patient: { reference: "Patient/patient-andre-williams", display: "Andre Williams" },
      insurer: { reference: "Organization/summit-health-hmo", display: "Summit Health HMO" },
      item: [
        {
          productOrService: {
            coding: [
              {
                system: "http://hl7.org/fhir/sid/ndc",
                code: "0169-4525-14",
                display: "Wegovy (semaglutide) injection"
              }
            ]
          },
          category: {
            coding: [
              {
                code: "pharmacy_benefit",
                display: "Pharmacy Benefit"
              }
            ]
          }
        }
      ]
    });
  });
});
