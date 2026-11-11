import "server-only";
import { isAuthConfigured } from "./config";
import { sanitizeReturnTo } from "./redirects";
import { getRecoveryContext } from "./recovery";

export async function getAuthPageContext(next?: unknown) {
  const configured = isAuthConfigured();
  return {
    configured,
    returnTo: typeof next === "string" && next ? sanitizeReturnTo(next) : "",
    recoveryAllowed: configured && (await getRecoveryContext()) !== null,
  };
}
