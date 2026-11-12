import "server-only";
import {
  SIGNING_SHARING_POLICY_VERSION,
  SIGNING_UPLOAD_POLICY_VERSION,
} from "@/lib/signing/policy";
import { getSubmissionConfiguration } from "@/server/documents/config";

/** Share the local/explicit remote development gate with separate consents. */
export function getSigningConfiguration() {
  const { maxBytes, environment } = getSubmissionConfiguration();
  return {
    maxBytes,
    uploadPolicyVersion: SIGNING_UPLOAD_POLICY_VERSION,
    sharingPolicyVersion: SIGNING_SHARING_POLICY_VERSION,
    environment,
  };
}
