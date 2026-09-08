import copy
import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("designation", Path(__file__).with_name("prepare-fictional-a-designation.py"))
d = importlib.util.module_from_spec(spec)
spec.loader.exec_module(d)


class DesignationTests(unittest.TestCase):
    def setUp(self):
        self.now = 1_788_732_000_000
        self.row = {
            "id": "a" * 64, "identityKey": "b" * 64, "purpose": "fictional_customer_pairing",
            "expiresAt": self.now - 300_000, "status": "pending", "ttl": (self.now - 300_000) // 1000,
            "observedAt": self.now - 600_000, "evidenceKind": "request_only_identity_observation",
            "customerAssignmentVerified": False, "approvalPerformed": False, "customerLinked": False,
        }

    def test_expired_observation_can_designate_only_fixed_fictional_a_not_reuse_request(self):
        original = copy.deepcopy(self.row)
        result = d.prepare(self.row, d.CONFIRMATION, self.now)
        self.assertEqual(result["customerId"], "staging-customer-a")
        self.assertEqual(result["identityKey"], self.row["identityKey"])
        self.assertEqual(result["expiresAt"], self.now + 14_400_000)
        self.assertNotIn("id", result)
        self.assertNotIn("requestCode", result)
        self.assertEqual(self.row, original)

    def test_observation_alone_is_not_customer_authority(self):
        for confirmation in [None, "", "yes", "staging-customer-b"]:
            with self.subTest(confirmation=confirmation), self.assertRaises(ValueError):
                d.prepare(self.row, confirmation, self.now)

    def test_rejects_injected_customer_or_claim_of_completed_verification(self):
        for field, value in [("customerId", "staging-customer-b"), ("customerAssignmentVerified", True),
                             ("approvalPerformed", True), ("customerLinked", True), ("purpose", "repair_owner")]:
            with self.subTest(field=field), self.assertRaises(ValueError):
                d.prepare({**self.row, field: value}, d.CONFIRMATION, self.now)

    def test_rejects_invalid_or_missing_fingerprint(self):
        for field in ("id", "identityKey"):
            for value in [None, "", "c" * 63, "G" * 64]:
                with self.subTest(field=field, value_type=type(value).__name__), self.assertRaises(ValueError):
                    d.prepare({**self.row, field: value}, d.CONFIRMATION, self.now)

    def test_rejects_invalid_time_evidence(self):
        for field, value in [("observedAt", self.now + 1), ("observedAt", -1),
                             ("observedAt", True), ("expiresAt", self.now), ("ttl", 1)]:
            with self.subTest(field=field), self.assertRaises(ValueError):
                d.prepare({**self.row, field: value}, d.CONFIRMATION, self.now)

    def test_stored_identity_evidence_is_not_a_live_request_or_reusable_approval(self):
        later = self.now + 172_800_000
        result = d.prepare(self.row, d.CONFIRMATION, later)
        self.assertEqual(result["expiresAt"], later + 14_400_000)
        self.assertEqual(result["identityKey"], self.row["identityKey"])
        self.assertNotIn("requestCode", result)
        self.assertNotIn("id", result)

    def test_rejects_invalid_current_time(self):
        for now in [True, None, 1.5, -1]:
            with self.subTest(now=now), self.assertRaises(ValueError):
                d.prepare(self.row, d.CONFIRMATION, now)

    @unittest.skipUnless(os.name == "posix", "POSIX owner/mode controls tested in Linux CI")
    def test_private_file_safety(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            folder.chmod(0o700)
            target = folder / "observation.json"
            target.write_text(json.dumps(self.row), encoding="utf-8")
            target.chmod(0o600)
            self.assertEqual(d.read_private(folder), self.row)
            target.chmod(0o644)
            with self.assertRaises(ValueError):
                d.read_private(folder)
            target.chmod(0o600)
            alias = folder / "linked.json"
            os.link(target, alias)
            with self.assertRaises(ValueError):
                d.read_private(folder)
            alias.unlink()
            target.rename(alias)
            target.symlink_to(alias)
            with self.assertRaises(OSError):
                d.read_private(folder)

    @unittest.skipUnless(os.name == "posix", "POSIX owner/mode controls tested in Linux CI")
    def test_rejects_broad_or_symlink_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "private"
            folder.mkdir(mode=0o700)
            folder.chmod(0o755)
            with self.assertRaises(ValueError):
                d.read_private(folder)
            folder.chmod(0o700)
            alias = Path(tmp) / "alias"
            alias.symlink_to(folder)
            with self.assertRaises(OSError):
                d.read_private(alias)


if __name__ == "__main__":
    unittest.main()
