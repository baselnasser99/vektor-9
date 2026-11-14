"""Stage the tick Lambda's code: sim/, lambdas/ and the pinned boto3 set (ADR-0017).

No Docker and no download at synth time. The `lambda` dependency group pins boto3 and every
dependency exactly; all are pure-Python wheels (py3-none-any), so the copy installed in this
Python 3.13 environment is byte for byte what an arm64 Linux install would get. Staging copies
those installed files, refusing any distribution that is not pure or not at its pinned version.
"""

import shutil
import sys
import tomllib
from importlib import metadata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# installer bookkeeping that differs between pip and uv and is not needed at runtime
SKIP_DIST_FILES = {"RECORD", "INSTALLER", "REQUESTED", "direct_url.json"}


class PackageError(RuntimeError):
    pass


def lambda_pins():
    """[(name, version)] from the `lambda` dependency group, which must use exact pins."""
    groups = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))
    pins = []
    for req in groups["dependency-groups"]["lambda"]:
        name, sep, version = req.partition("==")
        if not sep or not version or any(c in version for c in "<>=!~*,;"):
            raise PackageError(f"lambda group entries must be exact pins, got {req!r}")
        pins.append((name.strip(), version.strip()))
    return pins


def _copy(src, dst):
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dst)  # contents only, so the asset hash ignores timestamps and modes


def stage(out):
    """Write the package into the empty directory `out` and return it."""
    if sys.version_info[:2] != (3, 13):
        raise PackageError("stage the package from Python 3.13, the Lambda runtime")
    out = Path(out)
    for pkg in ("sim", "lambdas"):
        for src in sorted((ROOT / pkg).rglob("*.py")):
            _copy(src, out / src.relative_to(ROOT))
    for name, version in lambda_pins():
        try:
            dist = metadata.distribution(name)
        except metadata.PackageNotFoundError:
            raise PackageError(f"{name} is not installed: uv sync --group lambda") from None
        if dist.version != version:
            raise PackageError(f"{name} {dist.version} installed, {version} pinned")
        wheel = (dist.read_text("WHEEL") or "").splitlines()
        tags = [line.split(":", 1)[1].strip() for line in wheel if line.startswith("Tag:")]
        if "Root-Is-Purelib: true" not in wheel or not all(t.endswith("-none-any") for t in tags):
            raise PackageError(f"{name} is not a pure-Python wheel ({tags}); stop (ADR-0017)")
        for f in sorted(dist.files or [], key=str):
            if f.parts[0] == ".." or "__pycache__" in f.parts or f.suffix == ".pyc":
                continue  # console scripts outside site-packages, and bytecode
            if f.parts[0].endswith(".dist-info") and f.name in SKIP_DIST_FILES:
                continue
            _copy(dist.locate_file(f), out / f)
    return out
