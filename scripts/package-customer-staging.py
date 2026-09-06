"""Create a content-addressed ZIP from a verified bundle, never from the repo root.

Standard-library-only packaging; no AWS calls. Exactly seven files are allowed.
Secret-pattern checks are a limited safeguard, not a comprehensive secret audit.
"""
import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path

FILES = ("index.mjs", "package.json", "public/privacy.html", "public/signin.css",
         "public/signin.html", "public/signin.js", "public/terms.html")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("bundle", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--expected-entry-sha256", required=True)
    args = parser.parse_args()
    bundle = args.bundle.resolve(strict=True)
    paths = list(bundle.rglob("*"))
    assert not any(p.is_symlink() for p in paths), "Symlink in bundle"
    assert sorted(p.relative_to(bundle).as_posix() for p in paths if p.is_file()) == list(FILES), "Unexpected bundle files"
    data = {name: (bundle / name).read_bytes() for name in FILES}
    digest = lambda value: hashlib.sha256(value).hexdigest()
    assert digest(data["index.mjs"]) == args.expected_entry_sha256, "Entrypoint mismatch"
    assert json.loads(data["package.json"]) == {"type": "module", "private": True}
    for name, content in data.items():
        assert not re.search(rb"(?:AKIA|ASIA)[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", content), f"Credential marker in {name}"
    args.output.mkdir(parents=True, exist_ok=True)
    temporary = args.output / "customer-staging.pending.zip"
    # Exclusive creation refuses to overwrite an earlier candidate.
    with zipfile.ZipFile(temporary, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name in FILES:
            info = zipfile.ZipInfo(name, date_time=(2026, 9, 5, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data[name], compresslevel=9)
    with zipfile.ZipFile(temporary) as archive:
        assert archive.testzip() is None
        assert archive.namelist() == list(FILES)
        assert all(archive.read(name) == data[name] for name in FILES)
    checksum = digest(temporary.read_bytes())
    final = args.output / f"{checksum}.zip"
    assert not final.exists(), "Candidate already exists"
    temporary.rename(final)
    manifest = {"sha256": checksum, "bytes": final.stat().st_size,
                "s3Key": f"flo-customer/{checksum}.zip",
                "files": [{"path": name, "bytes": len(content), "sha256": digest(content)} for name, content in data.items()]}
    with (args.output / f"{checksum}.manifest.json").open("x") as output:
        json.dump(manifest, output, indent=2)
    print(json.dumps(manifest))


if __name__ == "__main__":
    main()
