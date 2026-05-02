import fetch from 'node-fetch';

export const checkHealth = async (port: number) => {
  const url = `http://127.0.0.1:${port}/`;
  const start = Date.now();

  try {
    const res = await fetch(url, {
      timeout: 10000,
      headers: {
        'Accept': 'text/html'
      }
    });

    const latencyMs = Date.now() - start;
    const statusCode = res.status;
    const contentType = res.headers.get('content-type') || '';

    // We only consider 200 OK as completely healthy for deployment
    if (statusCode !== 200) {
      return { ok: false, statusCode, contentType, latencyMs, error: `HTTP ${statusCode}` };
    }

    if (!contentType.includes('text/html')) {
       return { ok: false, statusCode, contentType, latencyMs, error: `Invalid content type: ${contentType}` };
    }

    const body = await res.text();
    const htmlOk = body.includes('<!DOCTYPE html>') || body.includes('<!doctype html>') || body.includes('<html');

    if (!htmlOk) {
       return { ok: false, statusCode, contentType, latencyMs, htmlOk, error: 'Response body does not appear to be valid HTML' };
    }

    return { ok: true, statusCode, contentType, latencyMs, htmlOk };
  } catch (error: any) {
    return { ok: false, latencyMs: Date.now() - start, error: error.message };
  }
};
