"""Offline regression tests: no AWS credentials, network or real customer data."""
import base64
import hashlib
import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

SPEC = importlib.util.spec_from_file_location("packager", Path(__file__).with_name("package-customer-enrollment.py"))
PACKAGER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACKAGER)


class EnrollmentPackagingTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.bundle = self.root / "bundle"
        self.bundle.mkdir()
        self.entry = b"export const handler = async () => ({ statusCode: 403 });\n"
        (self.bundle / "index.mjs").write_bytes(self.entry)
        self.expected = hashlib.sha256(self.entry).hexdigest()

    def package(self, role="approval", output="output"):
        return PACKAGER.package_bundle(role, self.bundle, self.root / output, self.expected)

    def test_private_roles_and_zip_hashes(self):
        for role in ("approval", "redemption"):
            manifest = self.package(role, role)
            zipped = self.root / role / (manifest["sha256"] + ".zip")
            self.assertEqual(manifest["codeSha256"], base64.b64encode(hashlib.sha256(zipped.read_bytes()).digest()).decode())
            self.assertEqual(manifest["s3Key"], f"flo-enrollment/{role}/{manifest['sha256']}.zip")
            self.assertEqual(manifest["bytes"], zipped.stat().st_size)
            with zipfile.ZipFile(zipped) as archive:
                self.assertEqual(archive.namelist(), ["index.mjs"])
                self.assertEqual(archive.read("index.mjs"), self.entry)
                self.assertIsNone(archive.testzip())
            self.assertEqual(json.loads(zipped.with_suffix(".manifest.json").read_text()), manifest)

    def test_request_assets_and_determinism(self):
        (self.bundle / "public").mkdir()
        for name in ("pairing.html", "pairing.js"):
            (self.bundle / "public" / name).write_text("synthetic")
        first = self.package("request", "one")
        second = self.package("request", "two")
        self.assertEqual(first, second)
        self.assertEqual([entry["path"] for entry in first["files"]], list(PACKAGER.FILES["request"]))

    def test_wrong_entry_hash(self):
        self.expected = "0" * 64
        with self.assertRaisesRegex(ValueError, "Entrypoint mismatch"):
            self.package()
        self.assertFalse((self.root / "output").exists())

    def test_invalid_hash(self):
        self.expected = "not-a-checksum"
        with self.assertRaises(ValueError):
            self.package()

    def test_unknown_role(self):
        with self.assertRaises(ValueError):
            self.package("administrator")

    def test_unexpected_credential_file(self):
        (self.bundle / ".env").write_text("SYNTHETIC_ONLY=true")
        with self.assertRaisesRegex(ValueError, "Unexpected"):
            self.package()

    def test_unexpected_directory(self):
        (self.bundle / "private").mkdir()
        with self.assertRaisesRegex(ValueError, "Unexpected"):
            self.package()

    def test_private_role_rejects_public_assets(self):
        (self.bundle / "public").mkdir()
        with self.assertRaisesRegex(ValueError, "Unexpected"):
            self.package("redemption")

    def test_missing_request_assets(self):
        with self.assertRaises(FileNotFoundError):
            self.package("request")

    def test_credential_marker(self):
        entry = self.entry + b"// amzn1.oa2-cs.synthetic-test-not-a-secret"
        (self.bundle / "index.mjs").write_bytes(entry)
        self.expected = hashlib.sha256(entry).hexdigest()
        with self.assertRaisesRegex(ValueError, "Credential marker"):
            self.package()

    def test_no_overwrite(self):
        first = self.package()
        original = (self.root / "output" / (first["sha256"] + ".zip")).read_bytes()
        with self.assertRaises(FileExistsError):
            self.package()
        self.assertEqual(original, (self.root / "output" / (first["sha256"] + ".zip")).read_bytes())

    def test_symlink_rejected(self):
        link = self.bundle / "linked.mjs"
        try:
            link.symlink_to(self.bundle / "index.mjs")
        except OSError as error:
            self.skipTest(f"Host cannot create symlinks: {error}")
        with self.assertRaisesRegex(ValueError, "Symlink"):
            self.package()


if __name__ == "__main__":
    unittest.main()
