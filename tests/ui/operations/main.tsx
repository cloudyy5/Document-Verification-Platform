import React from "react";
import { createRoot } from "react-dom/client";
import { OperationsOverview } from "../../../src/features/operations/overview";
import { operationsSnapshotSchema } from "../../../src/lib/operations/schema";
import "../../../src/app/globals.css";

const query = new URLSearchParams(window.location.search);
document.documentElement.dataset.theme =
  query.get("theme") === "dark" ? "dark" : "light";
const issues = query.has("issues")
  ? [
      {
        reference: "a".repeat(64),
        state: "failed",
        code: "RENDER_FAILED",
        updatedAt: "2026-11-11T07:00:00Z",
        attempts: 2,
      },
      {
        reference: "b".repeat(64),
        state: "timed_out",
        code: "PROCESSING_TIMEOUT",
        updatedAt: "2026-11-11T07:30:00Z",
        attempts: 1,
      },
    ]
  : [];
const data = operationsSnapshotSchema.parse({
  version: "operations-v1",
  asOf: "2026-11-11T08:00:00Z",
  periodStart: "2026-10-12T08:00:00Z",
  scope: "signing-v1",
  activeBasis: query.has("inactive-source") ? "unavailable" : "document-events",
  metrics: {
    registeredUsers: 12,
    activeDocumentUsers30d: query.has("inactive-source") ? null : 5,
    uploadedDocuments: 7,
    completedDocuments: 3,
    pendingRequests: 2,
    attentionResults: issues.length,
    sourceVersions: 7,
    awaitingResults: 2,
    processingResults: 0,
    legacyDocuments: 4,
  },
  attention: { items: issues, total: issues.length, limit: 20, hasMore: false },
});
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <p className="mb-5 rounded border border-border bg-muted px-4 py-3 text-xs font-medium text-foreground">
          UJI LOKAL · DATA SINTETIS · RANCANGAN R4 · BELUM TERHUBUNG KE DATABASE
        </p>
        <OperationsOverview
          data={query.has("unavailable") ? null : data}
          detail
        />
      </div>
    </div>
  </React.StrictMode>,
);
