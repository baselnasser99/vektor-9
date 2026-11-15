"""Tracked text files are stored with LF only (.gitattributes). CDK's asset fingerprint folds CRLF
into LF, so a CR in the Lambda sources would ship different bytes under the same asset hash."""

import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent


@pytest.mark.skipif(shutil.which("git") is None, reason="needs git")
def test_no_tracked_text_file_has_cr_in_the_index():
    out = subprocess.run(
        ["git", "ls-files", "--eol"], cwd=ROOT, capture_output=True, text=True, check=True
    ).stdout
    bad = [
        line.split("\t", 1)[1]
        for line in out.splitlines()
        if line.split()[0] in ("i/crlf", "i/mixed")
    ]
    assert not bad, f"CR in the index: {bad}"
