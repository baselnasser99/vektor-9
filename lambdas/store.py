"""The storage interface the tick handler uses (ADR-0014), and its errors.

A store holds objects by key. Implementations: store_memory.MemoryStore (tests) and
store_s3.S3Store (the data bucket).

    get(key) -> (body, etag, metadata)            raises NotFound
    put(key, body, *, if_match=None, if_none_match=False,
        content_type, content_encoding, cache_control, metadata) -> etag
                                                  raises PreconditionFailed (412)
                                                  or ConditionalConflict (409)
    list(prefix) -> keys

if_none_match=True writes only if the key does not exist; if_match=etag writes only if the object
still has that ETag. Either refusal is PreconditionFailed. ConditionalConflict means a conditional
write raced another one and was not applied: re-read and retry.
"""

from typing import Protocol


class StoreError(Exception):
    """A storage call failed. The run stops; the next slot retries."""


class NotFound(StoreError):
    """No object at that key (404)."""


class PreconditionFailed(StoreError):
    """A conditional write was refused (412): the key exists, or its ETag changed."""


class ConditionalConflict(StoreError):
    """A conditional write raced another conditional operation (409) and was not applied."""


class Store(Protocol):
    def get(self, key: str) -> tuple[bytes, str, dict[str, str]]: ...

    def put(
        self,
        key: str,
        body: bytes,
        *,
        if_match: str | None = None,
        if_none_match: bool = False,
        content_type: str,
        content_encoding: str | None,
        cache_control: str,
        metadata: dict[str, str],
    ) -> str: ...

    def list(self, prefix: str) -> list[str]: ...
