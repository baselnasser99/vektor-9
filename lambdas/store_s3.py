"""The store over an S3 bucket (ADR-0014). A thin adapter, exercised against AWS in the dev
deployment, and here only against a stub client.

boto3 is imported only when no client is passed in, so importing this module needs nothing beyond
the standard library. The Lambda package bundles a pinned boto3 (S1): IfMatch and IfNoneMatch on
put_object need a recent client.
"""

from lambdas.store import ConditionalConflict, NotFound, PreconditionFailed, StoreError


def _mapped(e):
    """The store error for a botocore ClientError, read by duck typing so a stub can raise it."""
    response = getattr(e, "response", None)
    if not isinstance(response, dict):
        return None
    code = str(response.get("Error", {}).get("Code", ""))
    status = response.get("ResponseMetadata", {}).get("HTTPStatusCode")
    if code in ("NoSuchKey", "NotFound", "404") or status == 404:
        return NotFound(code)
    if code in ("PreconditionFailed", "412") or status == 412:
        return PreconditionFailed(code)
    if code in ("ConditionalRequestConflict", "409") or status == 409:
        return ConditionalConflict(code)
    return StoreError(f"{code} ({status})")


class S3Store:
    def __init__(self, bucket, client=None):
        if client is None:
            import boto3

            client = boto3.client("s3")
        self.bucket = bucket
        self.client = client

    def _do(self, call, **kwargs):
        try:
            return call(Bucket=self.bucket, **kwargs)
        except Exception as e:
            if (mapped := _mapped(e)) is None:
                raise
            raise mapped from e

    def get(self, key):
        r = self._do(self.client.get_object, Key=key)
        return r["Body"].read(), r["ETag"], dict(r.get("Metadata", {}))

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
        kwargs = {
            "Key": key,
            "Body": body,
            "ContentType": content_type,
            "CacheControl": cache_control,
            "Metadata": metadata,
        }
        if content_encoding:
            kwargs["ContentEncoding"] = content_encoding
        if if_match is not None:
            kwargs["IfMatch"] = if_match
        if if_none_match:
            kwargs["IfNoneMatch"] = "*"
        return self._do(self.client.put_object, **kwargs)["ETag"]

    def list(self, prefix):
        keys, token = [], None
        while True:
            extra = {"ContinuationToken": token} if token else {}
            r = self._do(self.client.list_objects_v2, Prefix=prefix, **extra)
            keys += [o["Key"] for o in r.get("Contents", [])]
            if not r.get("IsTruncated"):
                return keys
            token = r["NextContinuationToken"]
