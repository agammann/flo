"""Bounded post-deployment check. Requires explicit approval for one model attempt.

Uses the current AWS credential chain without displaying credentials or signing
headers. Never refills the allowance. Does not test customer website identity.
"""

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import boto3
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from botocore.config import Config


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def check(args):
    config = Config(connect_timeout=5, read_timeout=15,
                    retries={"total_max_attempts": 1, "mode": "standard"})
    session = boto3.Session(region_name=args.region)
    identity = session.client("sts", config=config).get_caller_identity()
    assert identity["Account"] == args.account
    stack = session.client("cloudformation", config=config).describe_stacks(
        StackName="flo-bedrock-narrator")["Stacks"][0]
    assert stack["StackStatus"] == "UPDATE_COMPLETE"
    outputs = {x["OutputKey"]: x["OutputValue"] for x in stack["Outputs"]}
    url = outputs["NarratorEndpointUrl"]
    parsed = urllib.parse.urlsplit(url)
    assert parsed.scheme == "https" and parsed.path == "/narrate"
    assert not parsed.query and not parsed.fragment and not parsed.username and not parsed.password
    assert re.fullmatch(r"[a-z0-9]+\.execute-api\." + re.escape(args.region) + r"\.amazonaws\.com", parsed.netloc)
    assert outputs["AllowanceTableName"] == "flo-narration-allowance"
    table = session.resource("dynamodb", config=config).Table(outputs["AllowanceTableName"])
    opener = urllib.request.build_opener(NoRedirect)

    def counters():
        item = table.get_item(Key={"id": "flo-lifetime-v1"}, ConsistentRead=True).get("Item", {})
        assert item.get("schemaVersion") == 1
        return {"remaining": int(item["remaining"]), "used": int(item["used"])}

    def request(body, signed):
        data = json.dumps(body, separators=(",", ":")).encode()
        headers = {"Content-Type": "application/json"}
        if signed:
            auth_request = AWSRequest(method="POST", url=url, data=data, headers=headers)
            credentials = session.get_credentials()
            assert credentials is not None
            SigV4Auth(credentials.get_frozen_credentials(), "execute-api", args.region).add_auth(auth_request)
            headers = dict(auth_request.headers.items())
        http_request = urllib.request.Request(url, data=data, headers=headers, method="POST")
        try:
            response = opener.open(http_request, timeout=15)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            result = response.read(4097)
            assert len(result) <= 4096
            return response.code, json.loads(result), response.headers.get("apigw-requestid")

    before = counters()
    assert 1 <= before["remaining"] <= 100, "No approved existing allowance available; do not refill"
    valid = {"task": "part-comparison-lead", "optionCount": 3, "qualityTier": "premium"}
    status, body, request_id = request(valid, False)
    assert status == 403, ("unsigned", status)
    assert counters() == before, "Rejected unsigned request changed the allowance"
    print(json.dumps({"case": "unsigned", "status": status, "requestId": request_id}), flush=True)
    time.sleep(1.25)
    status, body, request_id = request({**valid, "optionCount": 0}, True)
    assert status == 400 and body.get("error") == "Invalid narration request", ("invalid", status)
    assert counters() == before, "Rejected malformed request changed the allowance"
    print(json.dumps({"case": "signed-invalid", "status": status, "requestId": request_id}), flush=True)
    time.sleep(1.25)
    # Exactly one request eligible for model invocation; no retries or refunds.
    status, body, request_id = request(valid, True)
    after = counters()
    print(json.dumps({"case": "signed-valid", "status": status, "requestId": request_id,
                      "before": before, "after": after,
                      "attemptsConsumed": before["remaining"] - after["remaining"]}), flush=True)
    assert status == 200, ("valid request failed; do not retry automatically", status)
    assert body.get("modelId") == outputs["BedrockModelId"]
    lead = body.get("lead", "")
    assert isinstance(lead, str) and 8 <= len(lead) <= 160 and len(lead.split()) <= 16
    assert not re.search(r"[$\d\n\r*#`]", lead)
    assert after["remaining"] == before["remaining"] - 1
    assert after["used"] == before["used"] + 1
    print(json.dumps({"result": "PASS", "lead": lead,
                      "scope": "live narrator only; no allowance reset or customer identity test"}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--account", required=True)
    parser.add_argument("--region", required=True)
    parser.add_argument("--allow-one-model-attempt", action="store_true", required=True)
    args = parser.parse_args()
    try:
        check(args)
        return 0
    except Exception as error:
        # Avoid echoing request objects, credentials, provider bodies, or URLs.
        print(json.dumps({"result": "FAIL", "errorType": type(error).__name__,
                          "instruction": "Inspect the checkpoint; do not retry a possibly spent attempt automatically."}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
