export type SigningRequestStatus =
  "pending" | "expired" | "cancelled" | "rejected" | "consented" | "completed";

export interface SigningUserCode {
  code: string;
  createdAt: string;
}

export interface SigningRecipient {
  id: string;
  code: string;
  displayName: string;
}

export interface SigningRequest {
  id: string;
  documentId: string;
  sourceVersionId: string;
  ownerName: string;
  recipientName: string;
  documentTitle: string | null;
  status: SigningRequestStatus;
  sentAt: string;
  expiresAt: string;
  cancelledAt: string | null;
  isOwner: boolean;
  canReadFile: boolean;
}

export interface SigningDocument {
  id: string;
  versionId: string;
  versionNo: number;
  title: string;
  categoryId: string;
  customDocumentType: string | null;
  documentDate: string | null;
  issuingInstitution: string | null;
  description: string | null;
  fileName: string;
  fileSizeBytes: number;
  sha256: string;
  createdAt: string;
  isOwner: boolean;
  request: SigningRequest | null;
}

export interface SigningPage<T> {
  items: T[];
  hasMore: boolean;
  cursor: string | null;
}

export interface SigningRequestReceipt {
  requestId: string;
  documentId: string;
  sourceVersionId: string;
  status: Exclude<SigningRequestStatus, "expired">;
  sentAt: string;
  expiresAt: string;
  cancelledAt: string | null;
}

export interface SendSigningRequestInput {
  sourceVersionId: string;
  recipientCode: string;
  recipientId: string;
  sharingPolicyVersion: string;
  sharingConsent: true;
}
