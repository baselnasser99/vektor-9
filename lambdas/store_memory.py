"""An in-memory store with S3's conditional-write semantics and fault injection, for tests.

Faults are hooks: callables hook(op, key, phase) run before ("before") and after ("after") every
call, outside the store's lock, so a hook may raise (a failure or a crash) or run a whole other
handler on the same store (two writers interleaved).
"""

import hashlib
import threading
from collections import Counter

from lambdas.store import NotFound, PreconditionFailed


class Crash(BaseException):
    """The process died here. A BaseException, so the handler's error path does not see it."""


class MemoryStore:
    def __init__(self):
        self.objects = {}  # key -> {"body", "etag", "metadata", "headers"}
        self.hooks = []
        self.writes = Counter()  # successful puts per key
        self._lock = threading.Lock()

    def _call(self, op, key, fn):
        for hook in list(self.hooks):
            hook(op, key, "before")
        with self._lock:
            result = fn()
        for hook in list(self.hooks):
            hook(op, key, "after")
        return result

    def get(self, key):
        def get():
            if key not in self.objects:
                raise NotFound(key)
            o = self.objects[key]
            return o["body"], o["etag"], dict(o["metadata"])

        return self._call("get", key, get)

    def put(
        self,
        key,
        body,
        *,
        if_match=None,
        if_none_match=False,
        content_type,
        content_encoding,
        cache_control,
        metadata,
    ):
        def put():
            current = self.objects.get(key)
            if if_none_match and current is not None:
                raise PreconditionFailed(key)
            if if_match is not None and (current is None or current["etag"] != if_match):
                raise PreconditionFailed(key)
            etag = f'"{hashlib.md5(bytes(body)).hexdigest()}"'  # what S3 returns for one-part puts
            self.objects[key] = {
                "body": bytes(body),
                "etag": etag,
                "metadata": dict(metadata),
                "headers": {
                    "ContentType": content_type,
                    "ContentEncoding": content_encoding,
                    "CacheControl": cache_control,
                },
            }
            self.writes[key] += 1
            return etag

        return self._call("put", key, put)

    def list(self, prefix):
        return self._call(
            "list", prefix, lambda: sorted(k for k in self.objects if k.startswith(prefix))
        )


def fault(op, key=None, *, phase="before", error=Crash, times=1):
    """A hook that raises `error` on the first `times` calls of `op` ("get", "put", "list") whose
    key contains `key` (any key if None), before or after the call takes effect."""
    left = [times]

    def hook(o, k, p):
        if o == op and p == phase and (key is None or key in k) and left[0] > 0:
            left[0] -= 1
            raise error(f"injected {op} {phase} {k}")

    return hook
