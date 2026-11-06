"""Local dev server for web/: plain static files with caching off, so edited modules always reload.

Run from the repo root: uv run python tools/serve.py  ->  http://localhost:8000/web/
(PORT in the environment picks another port)
"""

import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class Server(ThreadingHTTPServer):
    # On Windows, address reuse lets a second server share a busy port,
    # so the page might come from another worktree.
    allow_reuse_address = sys.platform != "win32"


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    Server(("127.0.0.1", port), partial(NoCache, directory=".")).serve_forever()
