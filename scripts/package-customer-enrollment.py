"""Package isolated enrollment bundles. No AWS calls or credential access.

Exact file allowlists complement (not replace) build dependency-boundary checks.
Credential-marker detection is a limited safeguard, not a secret audit.
"""
import argparse
import base64
import hashlib
import io
import json
import re
import zipfile
from pathlib import Path

FILES = {
    "request": ("index.mjs", "public/pairing.html", "public/pairing.js"),
    "redemption": ("index.mjs",),
    "approval": ("index.mjs",),
}


def package_bundle(kind, bundle, output, expected_entry_sha256):
    if kind not in FILES:
        raise ValueError("Unknown enrollment role")
    if not re.fullmatch(r"[a-f0-9]{64}", expected_entry_sha256):
        raise ValueError("Expected entrypoint SHA-256 must be lowercase hex")
    bundle = Path(bundle)
    if bundle.is_symlink():
        raise ValueError("Symlink bundle root")
    bundle = bundle.resolve(strict=True)
    if not bundle.is_dir():
        raise ValueError("Bundle must be a directory")
    names = FILES[kind]
    allowed_dirs = {"public"} if kind == "request" else set()
    paths = list(bundle.rglob("*"))
    for path in paths:
        name = path.relative_to(bundle).as_posix()
        if path.is_symlink():
            raise ValueError("Symlink in bundle")
        if path.is_dir() and name in allowed_dirs:
            continue
        if not path.is_file() or name not in names:
            raise ValueError("Unexpected bundle entry")
    data = {name: (bundle / name).read_bytes() for name in names}
    if hashlib.sha256(data["index.mjs"]).hexdigest() != expected_entry_sha256:
        raise ValueError("Entrypoint mismatch")
    for content in data.values():
        if re.search(rb"(?:AKIA|ASIA)[A-Z0-9]{16}|amzn1\.oa2-cs\.|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", content):
            raise ValueError("Credential marker in bundle")
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name in names:
            info = zipfile.ZipInfo(name, date_time=(2026, 9, 6, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data[name], compresslevel=9)
    zipped = buffer.getvalue()
    with zipfile.ZipFile(io.BytesIO(zipped)) as archive:
        if archive.testzip() is not None or archive.namelist() != list(names):
            raise ValueError("ZIP integrity failure")
        if any(archive.read(name) != data[name] for name in names):
            raise ValueError("ZIP content mismatch")
    digest = hashlib.sha256(zipped)
    checksum = digest.hexdigest()
    manifest = {
        "kind": kind, "sha256": checksum,
        "codeSha256": base64.b64encode(digest.digest()).decode("ascii"),
        "bytes": len(zipped), "s3Key": f"flo-enrollment/{kind}/{checksum}.zip",
        "files": [{"path": name, "bytes": len(content),
                   "sha256": hashlib.sha256(content).hexdigest()} for name, content in data.items()],
    }
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    final = output / f"{checksum}.zip"
    manifest_path = output / f"{checksum}.manifest.json"
    if final.exists() or manifest_path.exists():
        raise FileExistsError("Candidate already exists; use a new output directory")
    # Exclusive creation: never replace a previously reviewed candidate.
    with final.open("xb") as target:
        target.write(zipped)
    with manifest_path.open("x", encoding="utf-8", newline="\n") as target:
        json.dump(manifest, target, indent=2)
        target.write("\n")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("kind", choices=FILES)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--expected-entry-sha256", required=True)
    args = parser.parse_args()
    print(json.dumps(package_bundle(args.kind, args.bundle, args.output, args.expected_entry_sha256)))


if __name__ == "__main__":
    main()
