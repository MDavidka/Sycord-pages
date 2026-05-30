# Tiny proxy: forwards every request (including /api/*) to the local
# Next.js dev/start server on port 3000. The Kubernetes ingress sends
# /api/* to port 8001; this proxy bridges that to Next.js where the
# actual route handlers live.

import os
from urllib.parse import urljoin

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, Response

NEXT_ORIGIN = os.environ.get("NEXT_ORIGIN", "http://127.0.0.1:3000")

app = FastAPI()
client = httpx.AsyncClient(base_url=NEXT_ORIGIN, timeout=None)

HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
    "content-length",
}


@app.get("/health")
async def health():
    return {"ok": True, "proxy": NEXT_ORIGIN}


@app.api_route(
    "/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def proxy(path: str, request: Request):
    url = "/" + path
    if request.url.query:
        url = url + "?" + request.url.query

    headers = {
        k: v
        for k, v in request.headers.items()
        if k.lower() not in HOP_HEADERS
    }
    body = await request.body()

    req = client.build_request(
        request.method,
        url,
        headers=headers,
        content=body if body else None,
    )
    upstream = await client.send(req, stream=True)

    async def body_iter():
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk
        finally:
            await upstream.aclose()

    resp_headers = {
        k: v
        for k, v in upstream.headers.items()
        if k.lower() not in HOP_HEADERS
    }

    # If response is streaming SSE keep it streamed; otherwise just stream too —
    # StreamingResponse handles both fine.
    return StreamingResponse(
        body_iter(),
        status_code=upstream.status_code,
        headers=resp_headers,
        media_type=upstream.headers.get("content-type"),
    )
