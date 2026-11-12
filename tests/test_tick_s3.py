"""T21: the S3 store over a stub client, without boto3."""

import io

import pytest

from lambdas.store import ConditionalConflict, NotFound, PreconditionFailed, StoreError
from lambdas.store_s3 import S3Store


class ClientError(Exception):
    """Shaped like botocore's ClientError: the adapter reads only .response."""

    def __init__(self, code, status):
        super().__init__(code)
        self.response = {"Error": {"Code": code}, "ResponseMetadata": {"HTTPStatusCode": status}}


class StubClient:
    def __init__(self, error=None):
        self.calls, self.error = [], error

    def _record(self, name, kwargs):
        self.calls.append((name, kwargs))
        if self.error:
            raise self.error

    def get_object(self, **kw):
        self._record("get_object", kw)
        return {"Body": io.BytesIO(b"body"), "ETag": '"e1"', "Metadata": {"sim-version": "2"}}

    def put_object(self, **kw):
        self._record("put_object", kw)
        return {"ETag": '"e2"'}

    def list_objects_v2(self, **kw):
        self._record("list_objects_v2", kw)
        if "ContinuationToken" not in kw:
            return {"Contents": [{"Key": "a"}], "IsTruncated": True, "NextContinuationToken": "t"}
        return {"Contents": [{"Key": "b"}], "IsTruncated": False}


HEADERS = {
    "content_type": "application/json",
    "content_encoding": "gzip",
    "cache_control": "public, max-age=30",
    "metadata": {"sim-version": "2", "artifact-sha256": "ab"},
}


def test_get_put_list_pass_through():
    client = StubClient()
    store = S3Store("bucket", client)
    assert store.get("k") == (b"body", '"e1"', {"sim-version": "2"})
    assert store.put("k", b"x", if_match='"e1"', **HEADERS) == '"e2"'
    assert store.put("k", b"x", if_none_match=True, **HEADERS) == '"e2"'
    assert store.list("city/") == ["a", "b"]
    common = {
        "Bucket": "bucket",
        "Key": "k",
        "Body": b"x",
        "ContentType": "application/json",
        "ContentEncoding": "gzip",
        "CacheControl": "public, max-age=30",
        "Metadata": {"sim-version": "2", "artifact-sha256": "ab"},
    }
    assert client.calls == [
        ("get_object", {"Bucket": "bucket", "Key": "k"}),
        ("put_object", {**common, "IfMatch": '"e1"'}),
        ("put_object", {**common, "IfNoneMatch": "*"}),
        ("list_objects_v2", {"Bucket": "bucket", "Prefix": "city/"}),
        ("list_objects_v2", {"Bucket": "bucket", "Prefix": "city/", "ContinuationToken": "t"}),
    ]


def test_unconditional_put_without_encoding_sends_neither():
    client = StubClient()
    S3Store("bucket", client).put("g", b"{}", **{**HEADERS, "content_encoding": None})
    sent = client.calls[0][1]
    assert not {"IfMatch", "IfNoneMatch", "ContentEncoding"} & set(sent)


@pytest.mark.parametrize(
    "code, status, error",
    [
        ("NoSuchKey", 404, NotFound),
        ("404", 404, NotFound),
        ("PreconditionFailed", 412, PreconditionFailed),
        ("ConditionalRequestConflict", 409, ConditionalConflict),
        ("AccessDenied", 403, StoreError),
        ("SlowDown", 503, StoreError),
    ],
)
def test_errors_map_by_code_and_status(code, status, error):
    store = S3Store("bucket", StubClient(ClientError(code, status)))
    for call in (lambda: store.get("k"), lambda: store.put("k", b"x", **HEADERS)):
        with pytest.raises(error) as e:
            call()
        assert type(e.value) is error and isinstance(e.value.__cause__, ClientError)


def test_other_exceptions_pass_unchanged():
    store = S3Store("bucket", StubClient(TimeoutError("network")))
    with pytest.raises(TimeoutError):
        store.get("k")
