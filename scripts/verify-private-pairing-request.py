"""One exact, read-only request lookup. Run interactively in Linux CloudShell.

No request code in arguments, files, stdout, SDK logs, or shell history.
No customer selection, approval, invocation, session read, or link write.
This administrative evidence capture is not proof of operator authorization.
"""

import base64
import getpass
import hashlib
import json
import logging
import os
import re
import secrets
import stat
import sys
import tempfile
import time
import warnings
from decimal import Decimal
from pathlib import Path

ACCOUNT = "114599789754"
REGION = "us-west-2"
TABLE = "flo-customer-enrollment-state-EnrollmentRequests-1DISWL19S1ZRK"
FIELDS = ("id", "identityKey", "purpose", "expiresAt", "status", "ttl")
STAGES = ("sdk-imports", "sdk-session", "caller-identity", "caller-validation",
          "table-client", "synthetic-probes", "private-input", "request-lookup", "private-storage")


def safe_failure(stage, error):
    """Return only fixed diagnostic vocabulary, never provider/input text."""
    stage = stage if stage in STAGES else "unknown-stage"
    kind = type(error).__name__
    allowed_kinds = {"ModuleNotFoundError", "ImportError", "NoCredentialsError",
                     "PartialCredentialsError", "EndpointConnectionError", "ConnectTimeoutError",
                     "ReadTimeoutError", "ParamValidationError", "ValueError", "KeyboardInterrupt"}
    category = kind if kind in allowed_kinds else "unclassified"
    response = getattr(error, "response", None)
    detail = response.get("Error") if isinstance(response, dict) else None
    code = detail.get("Code") if isinstance(detail, dict) else None
    if isinstance(code, str) and code in {"AccessDenied", "AccessDeniedException", "ExpiredToken",
                                        "ExpiredTokenException", "InvalidClientTokenId", "UnrecognizedClientException",
                                        "ResourceNotFoundException", "ValidationException", "ThrottlingException"}:
        category = code
    return f"STOP: verification unconfirmed; stage={stage}; category={category}. Do not retry or create another request automatically."


def request_id(code):
    if not isinstance(code, str) or re.fullmatch(r"[A-Za-z0-9_-]{43}", code) is None:
        raise ValueError("Invalid private input")
    decoded = base64.urlsafe_b64decode(code + "=")
    if len(decoded) != 32 or base64.urlsafe_b64encode(decoded).decode().rstrip("=") != code:
        raise ValueError("Invalid private input")
    return hashlib.sha256(code.encode()).hexdigest()


def integer(value):
    if isinstance(value, bool) or not isinstance(value, (int, Decimal)) or value != int(value):
        raise ValueError("Invalid integer")
    return int(value)


def verify_row(row, key, now_ms):
    if not isinstance(row, dict) or set(row) != set(FIELDS):
        raise ValueError("Unexpected projection")
    if row["id"] != key or row["purpose"] != "fictional_customer_pairing" or row["status"] != "pending":
        raise ValueError("Not the pending request")
    if not isinstance(row["identityKey"], str) or re.fullmatch(r"[a-f0-9]{64}", row["identityKey"]) is None:
        raise ValueError("Invalid fingerprint")
    expiry, ttl = integer(row["expiresAt"]), integer(row["ttl"])
    if not now_ms < expiry <= now_ms + 300_000 or ttl != (expiry + 999) // 1000:
        raise ValueError("Expired or invalid lifetime")
    return {**row, "expiresAt": expiry, "ttl": ttl, "observedAt": now_ms,
            "evidenceKind": "request_only_identity_observation", "customerAssignmentVerified": False,
            "approvalPerformed": False, "customerLinked": False}


def lookup(table, key, now):
    # Intentionally exclude proof, raw Amazon subject, session key/revision, and
    # all auth-state attributes. Never scan or choose a recent arbitrary request.
    names = {f"#f{i}": name for i, name in enumerate(FIELDS)}
    response = table.get_item(Key={"id": key}, ConsistentRead=True,
                              ProjectionExpression=", ".join(names), ExpressionAttributeNames=names)
    return verify_row(response.get("Item"), key, now())


def save_private(evidence, root=None):
    if os.name != "posix":
        raise ValueError("POSIX private storage required")
    directory = Path(tempfile.mkdtemp(prefix="flo-request-evidence-", dir=root))
    info = directory.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
        raise ValueError("Private directory check failed")
    target = directory / "observation.json"
    fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as output:
        info = os.fstat(output.fileno())
        if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o600 or info.st_nlink != 1:
            raise ValueError("Private file check failed")
        json.dump(evidence, output, separators=(",", ":"))
        output.flush()
        os.fsync(output.fileno())
    return target


def permission_probes(table, access_error):
    """At most three reads on one random synthetic key; no scan or writes."""
    key = secrets.token_hex(32)
    names = {f"#f{i}": name for i, name in enumerate(FIELDS)}
    first = table.get_item(Key={"id": key}, ConsistentRead=True,
                           ProjectionExpression=", ".join(names), ExpressionAttributeNames=names)
    if "Item" in first:
        raise ValueError("Synthetic key unexpectedly exists")
    print("PROBE 1 PASS: projected synthetic-key read authorized; no item returned.", flush=True)
    for number, extra in [(2, {}), (3, {"ProjectionExpression": "#id, #proof", "ExpressionAttributeNames": {"#id": "id", "#proof": "proof"}})]:
        try:
            table.get_item(Key={"id": key}, ConsistentRead=True, **extra)
        except access_error as error:
            if error.response.get("Error", {}).get("Code") not in ("AccessDenied", "AccessDeniedException"):
                raise
        else:
            raise ValueError("Forbidden read unexpectedly authorized")
        print(f"PROBE {number} PASS: forbidden read rejected by AWS.", flush=True)


def main():
    # Refuse pipes, redirected input, Windows, and input arguments. getpass must
    # never fall back to echoing input in an unsupported terminal.
    if len(sys.argv) != 1 or os.name != "posix" or not sys.stdin.isatty() or not sys.stderr.isatty():
        print("STOP: run without arguments in an interactive Linux CloudShell terminal.")
        return 1
    stage = "sdk-imports"
    try:
        import boto3
        from botocore.config import Config
        from botocore.exceptions import ClientError

        logging.disable(logging.CRITICAL)
        config = Config(retries={"total_max_attempts": 1, "mode": "standard"},
                        connect_timeout=5, read_timeout=10)
        stage = "sdk-session"
        session = boto3.Session(region_name=REGION)
        sts = session.client("sts", endpoint_url=f"https://sts.{REGION}.amazonaws.com", config=config)
        stage = "caller-identity"
        caller = sts.get_caller_identity()
        stage = "caller-validation"
        if caller["Account"] != ACCOUNT or caller["Arn"] != f"arn:aws:iam::{ACCOUNT}:user/flo/flo-staging-operator":
            raise ValueError("Exact non-root operator required")
        stage = "table-client"
        table = session.resource("dynamodb", endpoint_url=f"https://dynamodb.{REGION}.amazonaws.com",
                                 config=config).Table(TABLE)
        stage = "synthetic-probes"
        permission_probes(table, ClientError)
        stage = "private-input"
        print("PRIVATE INPUT READY. Enter the code from your ONE approved browser request.", flush=True)
        with warnings.catch_warnings():
            warnings.simplefilter("error", getpass.GetPassWarning)
            code = getpass.getpass("Pairing code (hidden; never paste at a shell prompt): ")
        key = request_id(code)
        del code
        stage = "request-lookup"
        evidence = lookup(table, key, lambda: int(time.time() * 1000))
        stage = "private-storage"
        target = save_private(evidence)
        print("VERIFIED: exact pending request and a well-formed server-recorded identity fingerprint.")
        print("No approval, invitation or customer link was created. Let this request expire.")
        print(f"Private observation file: {target}")
        return 0
    except (Exception, KeyboardInterrupt) as error:
        # Input, provider, and filesystem exceptions may contain private values.
        print(safe_failure(stage, error))
        return 1


if __name__ == "__main__":
    sys.exit(main())
