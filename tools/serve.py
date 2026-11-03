"""Local dev server for web/: plain static files with caching off, so edited modules always reload.

Run from the repo root: uv run python tools/serve.py  ->  http://localhost:8000/web/
"""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 8000), partial(NoCache, directory=".")).serve_forever()
