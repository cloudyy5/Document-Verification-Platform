import React from "react";
import { createRoot } from "react-dom/client";
import { ArchiveVerification } from "../../../src/features/archive/verification";
import { ArchiveOverview } from "../../../src/features/archive/overview";
import { ArchiveDocumentList } from "../../../src/features/archive/document-list";
import { DocumentsWorkspace } from "../../../src/features/workspace/document-list";
import { archiveHistoryFiltersSchema } from "../../../src/lib/archive/schema";
import type {
  SigningDocument,
  SigningRequest,
} from "../../../src/server/signing/types";
import "../../../src/app/globals.css";

const query = new URLSearchParams(location.search),
  view = query.get("view");
document.documentElement.dataset.theme =
  query.get("theme") === "dark" ? "dark" : "light";
const id = "98000000-0000-4000-8000-000000000001",
  version = "98000000-0000-4000-8000-000000000002";
const request: SigningRequest = {
  id,
  documentId: id,
  sourceVersionId: version,
  ownerName: "Penguji A",
  recipientName: "Penguji B",
  documentTitle: "PDF SINTETIS ARSIP",
  status: "completed",
  sentAt: "2026-11-16T01:00:00Z",
  expiresAt: "2026-11-23T01:00:00Z",
  cancelledAt: null,
  isOwner: true,
  canReadFile: true,
};
const fixtureDocument: SigningDocument = {
  id,
  versionId: version,
  versionNo: 1,
  title: "PDF SINTETIS ARSIP",
  categoryId: id,
  customDocumentType: null,
  documentDate: null,
  issuingInstitution: null,
  description: null,
  fileName: "synthetic.pdf",
  fileSizeBytes: 100,
  sha256: "a".repeat(64),
  createdAt: request.sentAt,
  isOwner: true,
  request,
};
const page = { items: [fixtureDocument], cursor: null, hasMore: false };
const history = archiveHistoryFiltersSchema.parse({
  scope: query.get("scope") ?? undefined,
  status: query.get("status") ?? undefined,
});
const historyRequest: SigningRequest = {
  ...request,
  status: history.status,
  isOwner: history.scope === "sent",
  documentTitle:
    history.scope === "received" && history.status !== "completed"
      ? null
      : request.documentTitle,
  canReadFile: history.scope === "sent" || history.status === "completed",
};
const summary = {
  asOf: request.sentAt,
  metrics: {
    ownedDocuments: 2,
    sentRequests: 1,
    receivedRequests: 1,
    pending: 0,
    completed: 1,
    rejected: 0,
    expired: 0,
    cancelled: 0,
    consented: 0,
  },
  sent: [request],
  received: [],
};
createRoot(window.document.getElementById("root")!).render(
  <React.StrictMode>
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-8">
      <p className="mb-5 rounded border border-border bg-muted p-3 text-xs">
        UJI LOKAL · DATA SINTETIS · TANPA DATABASE
      </p>
      {view === "overview" ? (
        <ArchiveOverview
          data={query.has("failed") ? null : summary}
          legacyCount={0}
        />
      ) : view === "list" ? (
        <ArchiveDocumentList filters={{ scope: "owned" }} owned={page} />
      ) : view === "sent" || view === "received" ? (
        <ArchiveDocumentList
          filters={{ scope: view, status: "completed" }}
          requests={{
            items: [{ ...request, isOwner: view === "sent" }],
            cursor: "syntheticcursor",
            hasMore: true,
          }}
        />
      ) : view === "legacy" ? (
        <ArchiveDocumentList
          history
          filters={history}
          requests={{
            items: [historyRequest],
            cursor: "syntheticcursor",
            hasMore: true,
          }}
        />
      ) : view === "administrative" ? (
        <DocumentsWorkspace
          basePath="/documents/administrative"
          categories={[]}
          filters={{ limit: 20 }}
          result={{
            items: query.has("empty")
              ? []
              : [
                  {
                    id: "98000000-0000-4000-8000-000000000003",
                    submissionId: "98000000-0000-4000-8000-000000000004",
                    title: "PENGAJUAN ADMINISTRATIF SINTETIS",
                    category: { id, name: "Lainnya", slug: "lainnya" },
                    status: "pending_review",
                    currentVersionNo: 1,
                    submittedAt: request.sentAt,
                    registeredAt: null,
                    updatedAt: request.sentAt,
                  },
                ],
            limit: 20,
            nextCursor: null,
          }}
        />
      ) : (
        <ArchiveVerification canonicalOrigin={location.origin} />
      )}
    </main>
  </React.StrictMode>,
);
