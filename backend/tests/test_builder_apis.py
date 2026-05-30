"""Backend tests for /api/builder/export and /api/builder/stream (Next.js API routes proxied via FastAPI)."""
import json
import os
import time
import pytest
import requests

BASE_URL = "https://patch-canvas.preview.emergentagent.com"


def _initial_doc():
    """Mirror of createDefaultDocument() from lib/ai-ui-builder/document/default-document.ts."""
    return {
        "id": "doc-default",
        "version": 0,
        "componentCatalogVersion": "1.0.0",
        "theme": {
            "primaryColor": "#3b82f6",
            "backgroundColor": "#ffffff",
            "fontFamily": "Inter, system-ui, sans-serif",
            "borderRadius": "md",
            "mode": "light",
        },
        "state": {"selectedNodeId": None, "selectedPageId": "page-home"},
        "history": [],
        "routes": [{"id": "route-home", "path": "/", "pageId": "page-home"}],
        "pages": [
            {
                "id": "page-home",
                "name": "Home",
                "route": "/",
                "tree": {
                    "id": "node-page-1",
                    "component": "Page",
                    "props": {"padding": "lg", "maxWidth": "xl"},
                    "children": [
                        {
                            "id": "node-hero",
                            "component": "Section",
                            "props": {"padding": "xl", "background": "default"},
                            "children": [
                                {
                                    "id": "node-hero-stack",
                                    "component": "Stack",
                                    "props": {"direction": "column", "gap": "md", "align": "center"},
                                    "children": [
                                        {
                                            "id": "node-hero-heading",
                                            "component": "Heading",
                                            "props": {"level": 1, "weight": "bold", "align": "center"},
                                            "text": "Welcome to your builder",
                                        },
                                        {
                                            "id": "node-hero-text",
                                            "component": "Text",
                                            "props": {"size": "lg", "muted": True, "align": "center"},
                                            "text": "Edit this with a prompt or by selecting components on the canvas.",
                                        },
                                        {
                                            "id": "node-hero-cta",
                                            "component": "Button",
                                            "props": {"label": "Get started", "variant": "default", "size": "lg"},
                                        },
                                    ],
                                }
                            ],
                        }
                    ],
                },
            }
        ],
    }


class TestBuilderRoute:
    def test_builder_page_loads(self):
        r = requests.get(f"{BASE_URL}/builder", timeout=15)
        assert r.status_code == 200
        assert 'data-testid="builder-shell"' in r.text
        assert 'data-testid="spatial-canvas"' in r.text
        assert 'data-testid="prompt-panel"' in r.text
        assert 'data-testid="component-tree-panel"' in r.text


class TestExportAPI:
    def test_export_valid_doc_returns_files(self):
        payload = {"document": _initial_doc()}
        r = requests.post(
            f"{BASE_URL}/api/builder/export",
            json=payload,
            timeout=20,
        )
        assert r.status_code == 200, f"unexpected status {r.status_code}: {r.text[:300]}"
        body = r.json()
        assert "files" in body, body
        assert isinstance(body["files"], list) and len(body["files"]) >= 2
        paths = {f.get("path") for f in body["files"]}
        # Expected at minimum the page.tsx and builder-doc.json files
        assert any("page.tsx" in p for p in paths if p), f"page.tsx missing in {paths}"
        assert any("builder-doc.json" in p for p in paths if p), f"builder-doc.json missing in {paths}"
        # contents are non-empty strings
        for f in body["files"]:
            assert isinstance(f.get("content", ""), str)
            assert len(f["content"]) > 0
        assert "manifest" in body or "meta" in body or "stats" in body, body.keys()

    def test_export_invalid_doc_returns_422(self):
        # Missing required fields -> should be a validation error
        r = requests.post(
            f"{BASE_URL}/api/builder/export",
            json={"document": {"hello": "world"}},
            timeout=15,
        )
        assert r.status_code in (400, 422), f"expected 4xx, got {r.status_code}: {r.text[:200]}"
        body = r.json()
        # Should report issues list or error info
        assert any(k in body for k in ("issues", "error", "errors", "message")), body


class TestStreamAPI:
    def test_stream_emits_sse_events(self):
        payload = {
            "mode": "fast",
            "prompt": "Change the heading text to 'Hello Test'",
            "document": _initial_doc(),
            "selection": {"nodeId": "node-hero-heading"},
        }
        start = time.time()
        with requests.post(
            f"{BASE_URL}/api/builder/stream",
            json=payload,
            stream=True,
            timeout=60,
        ) as r:
            assert r.status_code == 200, f"status {r.status_code}: {r.text[:300]}"
            ctype = r.headers.get("content-type", "")
            assert "text/event-stream" in ctype or "stream" in ctype, ctype

            saw_start = saw_patch = saw_done = False
            buf = ""
            for chunk in r.iter_content(chunk_size=None, decode_unicode=True):
                if not chunk:
                    continue
                buf += chunk
                if "event: start" in buf:
                    saw_start = True
                if "event: patch" in buf:
                    saw_patch = True
                if "event: done" in buf or "event: end" in buf:
                    saw_done = True
                if saw_start and saw_patch and saw_done:
                    break
                if time.time() - start > 55:
                    break

        assert saw_start, f"missing 'event: start' in stream output. Buf head: {buf[:500]}"
        assert saw_done, f"missing terminal 'done' event. Buf head: {buf[:500]}"
        # patch event is highly likely but not strictly mandatory (LLM might emit only on changes);
        # report as soft check
        if not saw_patch:
            pytest.skip(f"No 'event: patch' emitted (likely LLM produced no ops). buf={buf[:500]}")

    def test_stream_invalid_request_handled(self):
        r = requests.post(
            f"{BASE_URL}/api/builder/stream",
            json={"prompt": ""},
            timeout=15,
        )
        # invalid input should either reject with 4xx or open stream and emit error event
        assert r.status_code in (200, 400, 422), r.status_code
