import { describe, expect, it } from "vitest";
import { GET as listPlanRows } from "../app/api/delegate-um/plan/route";
import { POST as submitDetermination } from "../app/api/delegate-um/requests/[umRequestId]/determination/route";
import { POST as startReview } from "../app/api/delegate-um/requests/[umRequestId]/start-review/route";
import { GET as listWorkqueue } from "../app/api/delegate-um/workqueue/route";
import { POST as submitPriorAuth } from "../app/api/um/prior-auths/route";

describe("delegate UM API routes", () => {
  it("reviews a submitted pharmacy UMRequest and exposes plan eligibility", async () => {
    const submittedResponse = await submitPriorAuth(
      new Request("http://localhost/api/um/prior-auths", {
        method: "POST",
        body: JSON.stringify({
          patientId: "patient-maya-chen",
          planId: "acme-health-ppo",
          requestType: "pharmacy_benefit",
          serviceCode: "wegovy_semaglutide"
        })
      })
    );
    const submitted = (await submittedResponse.json()) as { id: string };

    const workqueueResponse = await listWorkqueue();
    const workqueue = (await workqueueResponse.json()) as { rows: Array<{ id: string; requestType: string }> };

    expect(workqueueResponse.status).toBe(200);
    expect(workqueue.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: submitted.id,
          requestType: "pharmacy_benefit"
        })
      ])
    );

    const startResponse = await startReview(
      new Request(`http://localhost/api/delegate-um/requests/${submitted.id}/start-review`, {
        method: "POST",
        body: JSON.stringify({ reviewerId: "reviewer-ana" })
      }),
      { params: Promise.resolve({ umRequestId: submitted.id }) }
    );
    const started = (await startResponse.json()) as { id: string; state: string };

    expect(startResponse.status).toBe(200);
    expect(started).toMatchObject({
      id: submitted.id,
      state: "in_clinical_review"
    });

    const determinationResponse = await submitDetermination(
      new Request(`http://localhost/api/delegate-um/requests/${submitted.id}/determination`, {
        method: "POST",
        body: JSON.stringify({
          outcomeStatus: "approved",
          medicalNecessityReviewed: true,
          policyCriteriaChecked: true,
          rationaleCaptured: true
        })
      }),
      { params: Promise.resolve({ umRequestId: submitted.id }) }
    );
    const determined = (await determinationResponse.json()) as {
      id: string;
      state: string;
      outcomeStatus: string;
    };

    expect(determinationResponse.status).toBe(200);
    expect(determined).toMatchObject({
      id: submitted.id,
      state: "determined",
      outcomeStatus: "approved"
    });

    const planResponse = await listPlanRows();
    const planRows = (await planResponse.json()) as {
      rows: Array<{ umRequestId: string; id: string; incentiveStatus: string; paymentStatus: string }>;
    };

    expect(planResponse.status).toBe(200);
    expect(planRows.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          umRequestId: submitted.id,
          id: expect.stringMatching(/^ie_[a-f0-9]{32}$/),
          incentiveStatus: "paid",
          paymentStatus: "auto_executed"
        })
      ])
    );
  });

  it("rejects malformed determination payloads", async () => {
    const response = await submitDetermination(
      new Request("http://localhost/api/delegate-um/requests/missing/determination", {
        method: "POST",
        body: JSON.stringify({
          outcomeStatus: "maybe",
          medicalNecessityReviewed: true,
          policyCriteriaChecked: true,
          rationaleCaptured: true
        })
      }),
      { params: Promise.resolve({ umRequestId: "missing" }) }
    );

    await expect(response.json()).resolves.toEqual({ error: "INVALID_DETERMINATION" });
    expect(response.status).toBe(400);
  });
});
