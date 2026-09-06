import assert from "node:assert/strict";

/** Preserve the live stack verbatim except the request boundary's KMS branch
 * and its new key parameter. In particular, do not republish pinned versions. */
export function buildRequestDynamoUpdate(live, generated) {
  const next = JSON.parse(JSON.stringify(live));
  const isKms = statement => statement.Action === "kms:Decrypt";
  const original = next.Resources.RequestBoundary.Properties.PolicyDocument.Statement;
  const replacement = generated.Resources.RequestBoundary.Properties.PolicyDocument.Statement;
  assert.ok(original.some(s => s.Sid === "DenyWrongDecryptFunction"));
  assert.ok(replacement.some(s => s.Sid === "AllowRequestDynamoDecrypt"));
  assert.ok(!next.Parameters.RequestDynamoKeyArn, "Already patched: review rather than overwrite");
  const bySid = new Map(replacement.filter(isKms).map(s => [s.Sid, s]));
  next.Resources.RequestBoundary.Properties.PolicyDocument.Statement = original.map(s => {
    if (!isKms(s)) return s;
    const found = bySid.get(s.Sid); assert.ok(found, `Unreviewed existing KMS statement ${s.Sid}`);
    bySid.delete(s.Sid); return found;
  }).concat([...bySid.values()]);
  next.Parameters.RequestDynamoKeyArn = generated.Parameters.RequestDynamoKeyArn;
  assert.ok(JSON.stringify(next).length < 51200, "Use compact TemplateBody");
  return next;
}
