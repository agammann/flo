import { Sha256 } from "@aws-crypto/sha256-js";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";

// Credentials come from the server's AWS chain (SSO/profile/role), never the browser.
export const signNarratorRequest = async (endpoint: string, body: string, signal: AbortSignal): Promise<Record<string, string>> => {
  signal.throwIfAborted();
  const url = new URL(endpoint);
  const match = /^([a-z0-9]+)\.execute-api\.([a-z0-9-]+)\.amazonaws\.com$/.exec(url.hostname);
  if (url.protocol !== "https:" || match === null || url.pathname !== "/narrate" || url.search !== "" || url.username !== "" || url.password !== "" || url.port !== "") {
    throw new Error("Narrator endpoint must be an HTTPS API Gateway /narrate URL.");
  }
  const signer = new SignatureV4({ credentials: defaultProvider(), region: match[2]!, service: "execute-api", sha256: Sha256 });
  let rejectOnAbort: () => void = () => undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectOnAbort = () => { reject(new Error("AWS request signing timed out")); };
    signal.addEventListener("abort", rejectOnAbort, { once: true });
  });
  try {
    const signed = await Promise.race([signer.sign(new HttpRequest({
      protocol: "https:", hostname: url.hostname, path: url.pathname, method: "POST",
      headers: { host: url.hostname, "content-type": "application/json" }, body
    })), aborted]);
    return signed.headers;
  } finally {
    signal.removeEventListener("abort", rejectOnAbort);
  }
};
