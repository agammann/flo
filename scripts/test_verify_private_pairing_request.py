import base64
import hashlib
import importlib.util
import json
import os
import stat
import tempfile
import types
import unittest
from unittest.mock import patch, Mock
from decimal import Decimal
from pathlib import Path

spec = importlib.util.spec_from_file_location("verifier", Path(__file__).with_name("verify-private-pairing-request.py"))
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)


class RequestVerifierTests(unittest.TestCase):
    def setUp(self):
        self.code = base64.urlsafe_b64encode(bytes(range(32))).decode().rstrip("=")
        self.key = hashlib.sha256(self.code.encode()).hexdigest()
        self.now = 1_788_714_000_000
        self.row = {"id": self.key, "identityKey": "a" * 64, "purpose": "fictional_customer_pairing",
                    "expiresAt": Decimal(self.now + 200_000), "status": "pending",
                    "ttl": Decimal((self.now + 200_000) // 1000)}

    def test_canonical_code_hashed_without_normalization(self):
        self.assertEqual(v.request_id(self.code), self.key)
        for code in [" " + self.code, self.code + "=", self.code + "\n", "x" * 43, "", None]:
            with self.subTest(code_type=type(code).__name__), self.assertRaises(ValueError):
                v.request_id(code)

    def test_valid_pending_observation_is_not_an_ownership_grant(self):
        result = v.verify_row(self.row, self.key, self.now)
        self.assertFalse(result["customerAssignmentVerified"])
        self.assertFalse(result["approvalPerformed"])
        self.assertFalse(result["customerLinked"])
        self.assertNotIn(self.code, json.dumps(result))
        self.assertNotIn("proof", result)

    def test_expiry_and_ttl_fail_closed(self):
        for changes in [{"expiresAt": self.now}, {"expiresAt": self.now - 1},
                        {"expiresAt": self.now + 300_001}, {"ttl": 1},
                        {"expiresAt": True}, {"expiresAt": Decimal("1.5")},
                        {"expiresAt": str(self.now + 1000)}]:
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                v.verify_row({**self.row, **changes}, self.key, self.now)

    def test_other_request_consumed_malformed_and_extra_fields_rejected(self):
        for changes in [{"id": "b" * 64}, {"identityKey": "wrong"}, {"status": "approved"},
                        {"status": "consumed"}, {"purpose": "other"}, {"proof": {"sessionKey": "private"}}]:
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                v.verify_row({**self.row, **changes}, self.key, self.now)
        with self.assertRaises(ValueError):
            v.verify_row(None, self.key, self.now)

    def test_one_exact_consistent_projected_read_and_no_mutation(self):
        calls = []
        row = self.row

        class FakeTable:
            def get_item(self, **kwargs):
                calls.append(kwargs)
                return {"Item": row}

        v.lookup(FakeTable(), self.key, lambda: self.now)
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0]["Key"], {"id": self.key})
        self.assertTrue(calls[0]["ConsistentRead"])
        self.assertEqual(set(calls[0]["ExpressionAttributeNames"].values()), set(v.FIELDS))
        self.assertNotIn("proof", calls[0]["ExpressionAttributeNames"].values())

    def test_api_failure_not_retried(self):
        calls = []

        class Failure:
            def get_item(self, **kwargs):
                calls.append(kwargs)
                raise RuntimeError("simulated rejection")

        with self.assertRaises(RuntimeError):
            v.lookup(Failure(), self.key, lambda: self.now)
        self.assertEqual(len(calls), 1)

    def test_three_probes_are_bounded_projected_then_rejected_without_real_data(self):
        calls = []

        class Denied(Exception):
            response = {"Error": {"Code": "AccessDeniedException"}}

        class Table:
            def get_item(self, **kwargs):
                calls.append(kwargs)
                if len(calls) == 1:
                    return {}
                raise Denied()

        with patch("builtins.print"):
            v.permission_probes(Table(), Denied)
        self.assertEqual(len(calls), 3)
        self.assertEqual(len({call["Key"]["id"] for call in calls}), 1)
        self.assertNotIn("ProjectionExpression", calls[1])
        self.assertEqual(calls[2]["ExpressionAttributeNames"], {"#id": "id", "#proof": "proof"})

    def test_unexpected_probe_success_stops_without_third_read(self):
        calls = []

        class Table:
            def get_item(self, **kwargs):
                calls.append(kwargs)
                return {}

        with patch("builtins.print"), self.assertRaises(ValueError):
            v.permission_probes(Table(), RuntimeError)
        self.assertEqual(len(calls), 2)

    def test_first_probe_failure_stops_without_request_prompt_or_more_reads(self):
        calls = []

        class Table:
            def get_item(self, **kwargs):
                calls.append(kwargs)
                raise RuntimeError("simulated missing MFA")

        with self.assertRaises(RuntimeError):
            v.permission_probes(Table(), RuntimeError)
        self.assertEqual(len(calls), 1)

    def test_diagnostic_allowlist_never_prints_provider_message_or_private_values(self):
        error = RuntimeError(self.code)
        error.response = {"Error": {"Code": "AccessDeniedException", "Message": self.code},
                          "private": self.row}
        message = v.safe_failure("synthetic-probes", error)
        self.assertIn("stage=synthetic-probes", message)
        self.assertIn("category=AccessDeniedException", message)
        for private in [self.code, self.key, self.row["identityKey"]]:
            self.assertNotIn(private, message)

    def test_unknown_diagnostic_fields_and_malformed_provider_data_are_redacted(self):
        for response in [None, [], {"Error": None}, {"Error": {"Code": [self.code]}},
                         {"Error": {"Code": self.code}}]:
            error = RuntimeError(self.code)
            error.response = response
            message = v.safe_failure(self.code, error)
            self.assertIn("stage=unknown-stage; category=unclassified", message)
            self.assertNotIn(self.code, message)

    def test_main_first_probe_rejection_is_diagnostic_and_never_prompts_or_retries(self):
        class Denied(Exception):
            response = {"Error": {"Code": "AccessDeniedException", "Message": self.code}}

        table = Mock()
        table.get_item.side_effect = Denied()
        session = Mock()
        session.client.return_value.get_caller_identity.return_value = {
            "Account": v.ACCOUNT, "Arn": f"arn:aws:iam::{v.ACCOUNT}:user/flo/flo-staging-operator"}
        session.resource.return_value.Table.return_value = table
        modules = {"boto3": types.SimpleNamespace(Session=Mock(return_value=session)),
                   "botocore.config": types.SimpleNamespace(Config=Mock()),
                   "botocore.exceptions": types.SimpleNamespace(ClientError=Denied)}
        with patch.dict(v.sys.modules, modules), patch.object(v.sys, "argv", ["verifier.py"]), \
                patch.object(v.os, "name", "posix"), patch.object(v.sys.stdin, "isatty", return_value=True), \
                patch.object(v.sys.stderr, "isatty", return_value=True), patch.object(v.logging, "disable"), \
                patch.object(v.getpass, "getpass") as prompt, patch("builtins.print") as output:
            self.assertEqual(v.main(), 1)
        table.get_item.assert_called_once()
        prompt.assert_not_called()
        message = output.call_args.args[0]
        self.assertIn("stage=synthetic-probes; category=AccessDeniedException", message)
        self.assertNotIn(self.code, message)

    @unittest.skipUnless(os.name == "posix", "POSIX filesystem verification runs in isolated Linux Docker")
    def test_private_evidence_permissions_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as root:
            evidence = v.verify_row(self.row, self.key, self.now)
            first, second = v.save_private(evidence, root), v.save_private(evidence, root)
            self.assertNotEqual(first, second)
            self.assertEqual(stat.S_IMODE(first.parent.stat().st_mode), 0o700)
            self.assertEqual(stat.S_IMODE(first.stat().st_mode), 0o600)
            self.assertEqual(json.loads(first.read_text()), evidence)
            self.assertNotIn(self.code, first.read_text())


if __name__ == "__main__":
    unittest.main()
