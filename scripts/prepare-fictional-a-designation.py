"""Offline private designation preparation. No AWS calls, grants or customer links.

An observation identifies an Amazon account, not repair ownership. This helper
requires the separately recorded owner's explicit fictional-customer-A consent.
It cannot designate real customers or select a customer from an incoming request.
Run in the owner-only Linux CloudShell directory containing observation.json.
"""

import json
import importlib.util
import os
import re
import stat
import sys
import time
from pathlib import Path

spec = importlib.util.spec_from_file_location("pairing_private_storage", Path(__file__).with_name("verify-private-pairing-request.py"))
storage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(storage)

CONFIRMATION = "DESIGNATE_MY_OBSERVED_ACCOUNT_AS_FICTIONAL_CUSTOMER_A_ONLY"


def prepare(observation, confirmation, now_ms):
    if type(now_ms) is not int or now_ms <= 0:
        raise ValueError("Invalid current time")
    if confirmation != CONFIRMATION:
        raise ValueError("Separate fictional designation confirmation required")
    expected = {"id", "identityKey", "purpose", "expiresAt", "status", "ttl", "observedAt",
                "evidenceKind", "customerAssignmentVerified", "approvalPerformed", "customerLinked"}
    if not isinstance(observation, dict) or set(observation) != expected:
        raise ValueError("Unexpected observation schema")
    for field in ("id", "identityKey"):
        if not isinstance(observation[field], str) or re.fullmatch(r"[a-f0-9]{64}", observation[field]) is None:
            raise ValueError("Invalid observation fingerprint")
    for field in ("expiresAt", "ttl", "observedAt"):
        if type(observation[field]) is not int:
            raise ValueError("Invalid observation time")
    if (observation["purpose"] != "fictional_customer_pairing" or observation["status"] != "pending"
            or observation["evidenceKind"] != "request_only_identity_observation"
            or any(observation[f] is not False for f in ("customerAssignmentVerified", "approvalPerformed", "customerLinked"))):
        raise ValueError("Not an observation-only record")
    # The stable identity observation is evidence, not a reusable authorization.
    # Freshness is enforced on the NEW request/session and four-hour designation.
    if not 0 < observation["observedAt"] <= now_ms:
        raise ValueError("Observation is future-dated or invalid")
    if not observation["observedAt"] < observation["expiresAt"] <= observation["observedAt"] + 300_000:
        raise ValueError("Invalid original request lifetime")
    if observation["ttl"] != (observation["expiresAt"] + 999) // 1000:
        raise ValueError("Invalid original request TTL")
    # The expired request is evidence only. Approval later requires a NEW live
    # request, authenticated session, customer consent, and exact identity match.
    return {
        "purpose": "fictional_customer_pairing",
        "customerId": "staging-customer-a",
        "identityKey": observation["identityKey"],
        "authorityId": "alexander-ammann-fictional-staging-owner",
        "evidenceRef": "owner-confirmed-fictional-a-only-and-private-observation-2026-09-06",
        "expiresAt": now_ms + 14_400_000,
    }


def read_private(directory):
    """Pin directory/file descriptors; refuse symlinks, other owners or broad modes."""
    if os.name != "posix":
        raise ValueError("POSIX private storage required")
    directory_fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        info = os.fstat(directory_fd)
        if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
            raise ValueError("Private directory required")
        fd = os.open("observation.json", os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory_fd)
        with os.fdopen(fd, "r", encoding="utf-8") as source:
            info = os.fstat(source.fileno())
            if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid()
                    or stat.S_IMODE(info.st_mode) != 0o600 or info.st_nlink != 1 or info.st_size > 4096):
                raise ValueError("Private regular file required")
            return json.loads(source.read(4097))
    finally:
        os.close(directory_fd)


def main():
    if len(sys.argv) != 3 or sys.argv[2] != CONFIRMATION:
        print("STOP: supply the private observation directory and the separately authorized fictional-A confirmation.")
        return 1
    try:
        value = prepare(read_private(sys.argv[1]), sys.argv[2], int(time.time() * 1000))
        created = storage.save_private(value, root=Path.home())
        target = created.with_name("designation.json")
        created.rename(target)
        print(f"Prepared private designation file: {target}")
        print("Expires in four hours. Not deployed. No approval or customer link created.")
        return 0
    except Exception:
        print("STOP: private designation preparation failed. No private values displayed.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
