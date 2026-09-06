import assert from "node:assert/strict";
import { Buffer } from "node:buffer";

// Review-only transform. Do not feed the entire freshly generated template to
// deployment: immutable function versions and their live references must survive.
export function buildPrivateDynamoUpdate(live, generated) {
  assert.ok(!live.Parameters.PrivateDynamoKeyArn, "Already patched: review rather than overwrite");
  assert.ok(generated.Parameters.PrivateDynamoKeyArn, "Explicit private key review required");
  const next = JSON.parse(JSON.stringify(live));
  for (const cap of ["Approval", "Redemption"]) {
    const original = next.Resources[`${cap}Boundary`].Properties.PolicyDocument.Statement;
    const replacement = generated.Resources[`${cap}Boundary`].Properties.PolicyDocument.Statement;
    const isKms = s => s.Action === "kms:Decrypt";
    assert.ok(original.some(s => s.Sid === "DenyWrongDecryptFunction"));
    assert.ok(!original.some(s => s.Sid === "AllowPrivateDynamoDecrypt"));
    const bySid = new Map(replacement.filter(isKms).map(s => [s.Sid, s]));
    assert.ok(bySid.has("AllowPrivateDynamoDecrypt"));
    next.Resources[`${cap}Boundary`].Properties.PolicyDocument.Statement = original.map(s => {
      if (!isKms(s)) {
        const statement = { ...s };
        delete statement.Sid;
        return statement;
      }
      const found = bySid.get(s.Sid);
      assert.ok(found, `Unreviewed KMS statement ${s.Sid}`);
      bySid.delete(s.Sid);
      return found;
    }).concat([...bySid.values()]);
  }
  next.Parameters.PrivateDynamoKeyArn = generated.Parameters.PrivateDynamoKeyArn;
  assert.ok(Buffer.byteLength(JSON.stringify(next)) < 51200, "Use compact TemplateBody");
  return next;
}
