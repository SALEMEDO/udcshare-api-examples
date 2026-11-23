#!/usr/bin/env python3
"""Build one ZIP archive per NOVATECH demo folder (Python standard library only)."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
DEMOS = (
    "demo-1-portail-client",
    "demo-2-playground-api",
)
OUT = ROOT / "downloads"
OUT.mkdir(parents=True, exist_ok=True)

for demo in DEMOS:
    source = ROOT / "demos" / demo
    target = OUT / f"{demo}.zip"
    if not source.is_dir():
        raise SystemExit(f"Missing demo directory: {source}")
    with ZipFile(target, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(source.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(source.parent))
    print(f"Created {target.relative_to(ROOT)}")
