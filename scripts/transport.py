"""Retry transport failures to the hosted RPC, and nothing else.

The public endpoint drops connections mid-flight, serves a CDN error page
instead of JSON, and rate-limits bursts. None of those say anything about the
request, and giving up on one while polling a receipt strands a transaction
that was already submitted.

A real answer -- a refusal, an unknown method, a revert -- is never retried.
Retrying until a contract agrees with you is not verification.

    import transport  # noqa: F401  (patches the provider on import)
"""
import time

import requests
from genlayer_py.exceptions import GenLayerError
from genlayer_py.provider.provider import GenLayerProvider

ATTEMPTS = 8
_original = GenLayerProvider.make_request


def _is_transport(problem: GenLayerError) -> bool:
    text = str(problem)
    return (isinstance(problem.__cause__, requests.exceptions.RequestException)
            or "returned invalid JSON" in text
            or "code=-32429" in text      # rate limited
            or "code=-32029" in text      # reads over the per-minute allowance
            or "code=429" in text)


def _with_retry(self, method, params):
    delay = 5
    for attempt in range(ATTEMPTS):
        try:
            return _original(self, method, params)
        except GenLayerError as problem:
            if not _is_transport(problem) or attempt == ATTEMPTS - 1:
                raise
            print(f"    transport failure on {method} "
                  f"({attempt + 1}/{ATTEMPTS}): {str(problem)[:90]}; "
                  f"retrying in {delay}s", flush=True)
            time.sleep(delay)
            delay = min(delay * 2, 60)


GenLayerProvider.make_request = _with_retry
