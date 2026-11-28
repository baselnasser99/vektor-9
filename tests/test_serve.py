"""tools/serve.py under a burst like the page's module loads: all answered, caching off."""

import http.client
import importlib.util
import threading
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("serve", ROOT / "tools" / "serve.py")
serve = importlib.util.module_from_spec(spec)
spec.loader.exec_module(serve)


def test_burst_of_concurrent_gets():
    # A backlog this deep is what keeps a burst from being refused (the default of 5 is not).
    assert serve.Server.request_queue_size >= 64
    # The 50 smallest files, like the page's many small modules.
    files = sorted(ROOT.joinpath("web").rglob("*.*"), key=lambda f: f.stat().st_size)[:50]
    assert len(files) == 50
    server = serve.Server(("127.0.0.1", 0), partial(serve.NoCache, directory=str(ROOT)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    port = server.server_address[1]

    def get(path):
        conn = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
        try:
            conn.request("GET", "/" + path.relative_to(ROOT).as_posix())
            r = conn.getresponse()
            return r.status, r.getheader("Cache-Control"), len(r.read())
        finally:
            conn.close()

    try:
        with ThreadPoolExecutor(len(files)) as pool:
            got = list(pool.map(get, files))
    finally:
        server.shutdown()
        server.server_close()
        thread.join(5)
    assert not thread.is_alive()
    assert [s for s, _, _ in got] == [200] * len(files)
    assert all(c == "no-store" for _, c, _ in got)
    assert [n for _, _, n in got] == [f.stat().st_size for f in files]
