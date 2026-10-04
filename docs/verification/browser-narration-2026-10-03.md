# Browser narration verification — October 3, 2026

One shop-simulator comparison completed the real browser → local simulator →
IAM/SigV4 request → AWS narrator → visible browser response path. This is bounded
integration evidence for the optional narration sentence. It does not establish
Alexa+ deployment, account linking, certification, general model quality, or
reliability across repeated requests.

## Real request

The test used Chrome 154.0.8037.98 on Windows and service/runtime source
`4eb1cc7bc6e206d4b577b12895ee8161370d7d2a`. It opened work order 1842, recorded
“The alternator failed,” then submitted “Find compatible replacements under $300
that can arrive tomorrow” through the visible command form. The simulator's
signer, model configuration, response validation and 2,500 ms deadline were
unchanged.

At 02:31 UTC, the single comparison returned HTTP 200 from the AWS endpoint in
1,807 ms. The simulator recorded `amazon_bedrock_narration`, `kind: aws`,
`ok: true` in 1,819.5 ms and displayed this lead before its deterministic
comparison:

> Evaluating four premium service-part choices aids a technician in making a confident selection.

The route and display checks passed, but the lead has a factual scope error:
the four eligible offers have budget, premium, OEM and premium tiers. The caller
sends `comparison.ranked.length` together with
`comparison.recommendation.part.qualityTier`; the Lambda prompt incorrectly
applies the recommendation's tier to every option. Saying “four premium” therefore
mischaracterizes the comparison. The tier composition was checked against the
same source and command, without another paid request. Narration accuracy remains
an open verification gap.

The source correction labels the outgoing model context as `optionCount` and
`recommendedQualityTier`, explicitly restricts the tier to the recommendation,
and requests a tier-neutral lead. A regression inspects the actual Converse
input for each allowed tier through the existing local Lambda test harness.
This correction was deployed as recorded below. No further paid model request
was made for this deployment-only follow-up, so the corrected production lead
remains unverified; the historical output above remains unchanged.

The lead also has 13 words. It satisfies the runtime's limit of 16 words and its
no-digits/no-prices display contract, but exceeds the prompt's request for at
most 12 words. The narrator did not independently inspect or rank the offers;
accepted narration is not proof of factual accuracy or full prompt compliance.

A consistent allowance read changed from 97 remaining / 3 used to 96 remaining
/ 4 used. No purchase, scheduling, customer approval or monetary calculation was
delegated to the model. The browser reported no page errors or external browser
requests. All six local services and the isolated browser were stopped afterward.

## Retained failure and authorization boundary

An earlier attempt at 02:02 UTC returned HTTP 403 in 188 ms. Its narration trace
reported `ok: false`, the simulator displayed deterministic fallback, and the
allowance stayed at 97 remaining / 3 used. The caller lacked permission to invoke
that route; IAM simulation reported an implicit denial.

The successful attempt used a separately approved, temporary permission for the
exact narrator route. That permission was removed immediately afterward. The
caller again had no inline policies, its existing sign-in policy was unchanged,
and simulation again denied route invocation. This verification does not leave
the caller authorized or make AWS narration available to every local installation.

## Status badge regression checks

The previous badge turned green when narration was configured, even after the
403 caused local fallback. The updated badge uses actual narration outcomes:

- Configuration alone: “Bedrock configured · awaiting first result,” with an amber dot.
- Latest successful narration: “Bedrock · last narration succeeded,” with a green dot.
- Latest failed attempt: “Local fallback · last Bedrock attempt failed,” with an amber dot.

Only a Boolean `ok` value from an `aws` invocation of
`amazon_bedrock_narration` updates this history. Unrelated commands preserve it;
a delayed health response cannot replace a recorded result with configuration.
Here, success means the service returned a lead accepted by the display validator;
it does not certify the model's factual accuracy.

Seven separate model-free browser cases exercised initial/configured state,
failure and unrelated commands, success followed by failure, both delayed-health
races, optional/unrecognized invocations, and responsive accessibility. They
passed 17 state assertions through eight actual form submissions. Six screenshots
at 1440 and 390 pixels were visually checked, with no clipping or horizontal
overflow, page/console errors, or unexpected requests. Browser and listener
cleanup passed. These cases used local fixture responses, including a synthetic
success trace; they are display tests, separate from the single real AWS request
above. The focused permanent regression is
`tests/integration/narration-status-ui.test.ts`.

## Deployment-only follow-up — October 4, 2026

At 06:04:49 UTC, `flo-bedrock-narrator` was observed in `UPDATE_COMPLETE` and
change set `flo-narration-context-20261003T0304Z` in `EXECUTE_COMPLETE`. The
deployed template exactly matched the reviewed candidate
`2c297e9ea1802c135730126e9fe4f19b7cf1a8ef`; comparison with the previous template
found only `NarratorFunction.Properties.Code.ZipFile` changed. CloudFormation
also recorded a dependent integration URI update; neither resource was replaced.

The function reported `Active` and `Successful`. Configured model, runtime name,
IAM role, memory and timeout, plus stack parameters and outputs, were unchanged.
The allowance remained 96 remaining / 4 used. Existing local and CI results are
retained; no additional Invoke grant or paid model request was made. The corrected
production lead was not resampled, so this deployment does not establish improved
model accuracy or prompt compliance.
