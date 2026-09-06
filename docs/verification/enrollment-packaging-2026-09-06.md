# Enrollment deployment packages: local verification

Date: 2026-09-06. This is packaging evidence, not deployment approval or live enrollment evidence.

The enrollment application was rebuilt from the unchanged runtime source at
`cb73f6444f08a21998daf962a6413623777aa6ef`, with the new packaging script and CI
test step in the working tree. No application or CloudFormation source changed.
The runtime template retains SHA-256
`a037959dc25edbb0063fdff78a03bb0815c512b308ecd5408c47c3a58fc56dde`.

## Packaging controls

`scripts/package-customer-enrollment.py` uses only the Python standard library.
It makes no network/AWS calls and does not read credentials. Its role-specific
allowlist permits `index.mjs` for each private handler and additionally
`public/pairing.html` and `public/pairing.js` for the public request handler.
It rejects unexpected files/directories, symlinks, an unexpected entrypoint hash,
and a limited set of credential markers. The marker check is not a comprehensive
secret audit. The build's dependency-boundary checks remain separately necessary:
filenames alone do not prove that a bundle has the correct authority.

ZIP member order, timestamps and modes are fixed. The script verifies ZIP CRCs,
member names and extracted bytes before writing content-addressed candidates,
and refuses to overwrite existing candidates. Each manifest includes entry/file
hashes, ZIP size, hexadecimal SHA-256, Lambda-compatible base64 `CodeSha256`, and
the proposed S3 key. Compression output is reproducible within the tested
runtime; a different Python/zlib toolchain may produce different ZIP bytes.
Use the exact reviewed ZIP and its checksum, not a later repackaging.

Example after `pnpm build:enrollment` (substitute the independently computed hash):

```sh
python3 scripts/package-customer-enrollment.py request \
  dist/customer-enrollment/request dist/enrollment-packages/REVIEW-ID/request \
  --expected-entry-sha256 ENTRYPOINT_SHA256
```

Repeat for `redemption` and `approval`. Generated ZIPs and manifests remain under
git-ignored `dist/`; the source repository is not itself a Lambda deployment ZIP.

## Exact local candidates

Generated directory: `dist/enrollment-packages/20260906T141045Z`.
Each proposed S3 key is `flo-enrollment/ROLE/SHA256.zip`.

| Role | ZIP bytes | ZIP SHA-256 |
| --- | ---: | --- |
| request | 381833 | `3822fea17cc334b376031bf2974756533afb8baf7c4ba52520a2b343d41087fe` |
| redemption | 343735 | `9d72147896e5770327ce1f0c6f6a0c9529e9daee4952cdc6b696807a4e3cb654` |
| approval | 339605 | `98b962142feb83f9ca8e4a03dd18a12c0c198e8ed15a0e321a414842cfc60d33` |

No S3 upload was performed. There are no newly obtained S3 object version IDs,
runtime change sets, Lambda versions, public enrollment routes or customer links.

## Verification

- All 13 workspace builds and typechecks passed; ESLint passed with zero warnings.
- Full regression suite: 151 tests, 148 passed, 3 platform skips, zero failures.
- Enrollment runtime boundary/template tests: 17 passed.
- Packaging tests on Windows: 11 passed, one symlink-privilege skip.
- The same packaging tests in existing isolated Linux Docker: all 12 passed,
  including symlink rejection, without network access or AWS credentials.
- Rebuilt bundle smoke tests passed, using synthetic configuration only.
- All three candidate ZIPs were extracted into a fresh local directory and their
  actual entrypoints smoke-tested successfully. Public assets load; disabled,
  unauthenticated and malformed requests fail closed. Private approval rejects
  disabled/unconfigured operation and malformed/expired designations.

## Remaining gates

AWS Core returned `UNAUTHORIZED` / `TRIGGER_REAUTHENTICATION` before this turn's
read-only STS/IAM checks reached AWS. This is a connector authentication blocker,
not a new IAM policy denial. No old credential file was used as a substitute.

The earlier CloudWatch Logs policy-simulator discrepancy is still unresolved.
The exact resource scopes have not been widened. After reconnection, resume the
read-only control simulations and investigate before preparing the reviewed
runtime change set. Simulation is not proof of actual runtime log delivery;
deployment verification must check that separately.

The previous raw Guard failures and scoped exception review remain as documented
in [runtime validation](enrollment-runtime-validation-2026-09-06.md).
Packaging success does not clear those findings, prove hosted linked-customer
access, or establish official Alexa+ account linking/certification.

Artifact upload and exact resource/cost review precede any runtime execution.
Enrollment enablement, customer mappings, Devpost submission and video publication
remain separately gated. The replacement demo must show the verified final experience.
