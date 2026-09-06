"""Upload one owner-approved content-addressed ZIP; never deploy or read secrets.

Run only after approval of the exact digest and destination. Refuses overwrite.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import sys

import boto3
from botocore.exceptions import ClientError


def upload(args):
    data = args.zip.read_bytes()
    if hashlib.sha256(data).hexdigest() != args.sha256:
        raise ValueError("Artifact checksum mismatch")
    session = boto3.Session(region_name="us-west-2")
    if session.client("sts").get_caller_identity()["Account"] != "114599789754":
        raise ValueError("Wrong AWS account")
    s3 = session.client("s3")
    target = {"Bucket": "flo-customer-artifacts-artifacts-wiyewwqt3d1r", "ExpectedBucketOwner": "114599789754"}
    if s3.get_bucket_location(**target)["LocationConstraint"] != "us-west-2":
        raise ValueError("Wrong bucket region")
    if s3.get_bucket_versioning(**target).get("Status") != "Enabled":
        raise ValueError("Versioning must be enabled")
    blocks = s3.get_public_access_block(**target)["PublicAccessBlockConfiguration"]
    if not all(blocks.get(key) is True for key in ["BlockPublicAcls", "IgnorePublicAcls", "BlockPublicPolicy", "RestrictPublicBuckets"]):
        raise ValueError("Public access blocks must all be enabled")
    if s3.get_bucket_policy_status(**target)["PolicyStatus"]["IsPublic"]:
        raise ValueError("Bucket must not be public")
    key = f"flo-customer/{args.sha256}.zip"
    checksum = base64.b64encode(hashlib.sha256(data).digest()).decode("ascii")
    # Single conditional PUT is intentional for this small artifact: unlike a
    # managed transfer it can require IfNoneMatch and return the exact VersionId.
    response = s3.put_object(**target, Key=key, Body=data, IfNoneMatch="*",
                             ContentType="application/zip", ServerSideEncryption="AES256",
                             ChecksumSHA256=checksum)
    version = response["VersionId"]
    if not version or version == "null":
        raise ValueError("Missing immutable object version")
    record = {"bucket": target["Bucket"], "key": key, "versionId": version,
              "sha256": args.sha256, "bytes": len(data)}
    # Record the mutation identity before verification, so an uncertain failure
    # is investigated rather than retried with an overwrite or duplicate upload.
    print(json.dumps({"uploaded": record}), flush=True)
    obj = {**target, "Key": key, "VersionId": version, "ChecksumMode": "ENABLED"}
    head = s3.head_object(**obj)
    if head["ContentLength"] != len(data) or head.get("ChecksumSHA256") != checksum or head.get("ServerSideEncryption") != "AES256":
        raise ValueError("Uploaded object metadata mismatch")
    response = s3.get_object(**obj)
    with response["Body"] as body:
        downloaded = body.read()
    if downloaded != data:
        raise ValueError("Downloaded object differs from approved artifact")
    print(json.dumps({"verified": {**record, "checksumSHA256": checksum,
                                  "encryption": head["ServerSideEncryption"],
                                  "lastModified": head["LastModified"].isoformat(),
                                  "byteForByteReadback": True}}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("zip", type=Path)
    parser.add_argument("--sha256", required=True)
    args = parser.parse_args()
    if len(args.sha256) != 64 or any(c not in "0123456789abcdef" for c in args.sha256):
        parser.error("sha256 must be a lowercase 64-character hex digest")
    try:
        upload(args)
        return 0
    except ClientError as error:
        print(f"AWS upload/verification failed: {error.response['Error']['Code']}. Inspect any recorded upload before retrying.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
