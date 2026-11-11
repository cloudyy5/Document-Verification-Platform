import { describe, expect, it } from "vitest";
import { operationsSnapshotSchema } from "@/lib/operations/schema";

function snapshot() {
  return {
    version: "operations-v1",
    asOf: "2026-11-11T08:00:00Z",
    periodStart: "2026-10-12T08:00:00Z",
    scope: "signing-v1",
    activeBasis: "document-events",
    metrics: {
      registeredUsers: 4,
      activeDocumentUsers30d: 2,
      uploadedDocuments: 2,
      completedDocuments: 1,
      pendingRequests: 1,
      attentionResults: 0,
      sourceVersions: 2,
      awaitingResults: 0,
      processingResults: 0,
      legacyDocuments: 3,
    },
    attention: { items: [], total: 0, limit: 20, hasMore: false },
  };
}

describe("strict monitoring DTO (synthetic input, no provider)", () => {
  it("accepts a consistent snapshot and distinguishes a real zero from unavailable", () => {
    const valid = operationsSnapshotSchema.parse(snapshot());
    expect(valid.metrics.attentionResults).toBe(0);
    const unavailable = {
      ...snapshot(),
      activeBasis: "unavailable",
      metrics: { ...snapshot().metrics, activeDocumentUsers30d: null },
    };
    expect(
      operationsSnapshotSchema.parse(unavailable).metrics
        .activeDocumentUsers30d,
    ).toBeNull();
    expect(
      operationsSnapshotSchema.safeParse({
        ...unavailable,
        metrics: { ...unavailable.metrics, activeDocumentUsers30d: 0 },
      }).success,
    ).toBe(false);
  });
  it.each([
    "email",
    "title",
    "storage_path",
    "owner_id",
    "sourceSha256",
    "access_token",
  ])(
    "rejects injected %s instead of rendering confidential fields",
    (field) => {
      expect(
        operationsSnapshotSchema.safeParse({
          ...snapshot(),
          [field]: "must-not-be-disclosed",
        }).success,
      ).toBe(false);
      const data = snapshot();
      expect(
        operationsSnapshotSchema.safeParse({
          ...data,
          attention: {
            ...data.attention,
            total: 1,
            items: [
              {
                reference: "a".repeat(64),
                state: "failed",
                code: "RENDER_FAILED",
                updatedAt: data.asOf,
                attempts: 1,
                [field]: "must-not-be-disclosed",
              },
            ],
          },
          metrics: { ...data.metrics, attentionResults: 1 },
        }).success,
      ).toBe(false);
    },
  );
  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN])(
    "rejects invalid/unsafe count %s",
    (value) => {
      const data = snapshot();
      expect(
        operationsSnapshotSchema.safeParse({
          ...data,
          metrics: { ...data.metrics, registeredUsers: value },
        }).success,
      ).toBe(false);
    },
  );
  it("rejects inconsistent totals, states, windows and duplicate references", () => {
    const data = snapshot();
    for (const invalid of [
      { ...data, metrics: { ...data.metrics, completedDocuments: 3 } },
      { ...data, metrics: { ...data.metrics, sourceVersions: 1 } },
      { ...data, metrics: { ...data.metrics, activeDocumentUsers30d: 5 } },
      { ...data, attention: { ...data.attention, total: 1, hasMore: true } },
      { ...data, periodStart: "2026-11-10T08:00:00Z" },
    ])
      expect(operationsSnapshotSchema.safeParse(invalid).success).toBe(false);
    const issue = {
      reference: "a".repeat(64),
      state: "timed_out",
      code: "PROCESSING_TIMEOUT",
      updatedAt: data.asOf,
      attempts: 1,
    };
    const withIssue = {
      ...data,
      metrics: { ...data.metrics, attentionResults: 1 },
      attention: { ...data.attention, total: 1, items: [issue] },
    };
    expect(operationsSnapshotSchema.safeParse(withIssue).success).toBe(true);
    for (const items of [
      [{ ...issue, code: "RENDER_FAILED" }],
      [{ ...issue, updatedAt: "2026-11-12T08:00:00Z" }],
      [issue, issue],
    ]) {
      expect(
        operationsSnapshotSchema.safeParse({
          ...withIssue,
          attention: { ...withIssue.attention, items },
        }).success,
      ).toBe(false);
    }
  });
});
