import { appendLog } from "./logs.js";
function inspectHtmlResponse(response, body, latencyMs) {
    const contentType = response.headers.get("content-type") || "";
    const bodyLower = body.toLowerCase().slice(0, 4096);
    const htmlOk = /<!doctype html|<html/i.test(bodyLower);
    const binaryLike = /[\u0000-\u0008\u000b\u000c\u000e-\u0019]/.test(bodyLower);
    const artifactLike = /\.next\//i.test(bodyLower) || /application\/octet-stream/i.test(contentType);
    const gzipOrCompressed = /(?:content-encoding|^gzip|^comp)/i.test(bodyLower);
    const ok = response.status === 200 && /text\/html/i.test(contentType) && htmlOk && !binaryLike && !artifactLike && !gzipOrCompressed;
    const detail = [
        `status=${response.status}`,
        `contentType=${contentType}`,
        `htmlOk=${htmlOk}`,
        `binaryLike=${binaryLike}`,
        `artifactLike=${artifactLike}`,
        `gzipOrCompressed=${gzipOrCompressed}`,
        `latencyMs=${latencyMs}`,
        `ok=${ok}`,
    ].join(" ");
    let errorMessage = "";
    if (!ok) {
        if (response.status !== 200) {
            errorMessage = `Health check returned HTTP ${response.status} (expected 200)`;
        }
        else if (binaryLike) {
            errorMessage = "Invalid root response: detected binary/non-printable content";
        }
        else if (gzipOrCompressed) {
            errorMessage = "Invalid root response: appears to be compressed/gzip data instead of HTML";
        }
        else if (artifactLike) {
            errorMessage = "Invalid root response: appears to be a build artifact, not HTML";
        }
        else if (!/text\/html/i.test(contentType)) {
            errorMessage = `Invalid root response: Content-Type is "${contentType}" (expected text/html)`;
        }
        else if (!htmlOk) {
            errorMessage = "Invalid root response: missing <html> or <!doctype html> tag";
        }
        else {
            errorMessage = "Health check failed: root route did not return valid HTML";
        }
    }
    return {
        ok,
        htmlOk,
        statusCode: response.status,
        contentType,
        latencyMs,
        error: errorMessage || undefined,
        detail,
    };
}
async function readAndInspectResponse(projectId, label, response, start) {
    const contentType = response.headers.get("content-type") || "";
    let body = "";
    try {
        body = await response.text();
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await appendLog(projectId, "health", `${label} body-read-failed: ${message}`);
        return {
            ok: false,
            htmlOk: false,
            statusCode: response.status,
            contentType,
            latencyMs: Date.now() - start,
            error: `Failed to read response body: ${message}`,
            detail: "",
        };
    }
    const result = inspectHtmlResponse(response, body, Date.now() - start);
    await appendLog(projectId, "health", `${label} ${result.detail}`);
    return result;
}
export async function runHealthCheck(projectId, port) {
    const start = Date.now();
    let response;
    try {
        response = await fetch(`http://127.0.0.1:${port}/`, {
            headers: { Accept: "text/html" },
            redirect: "follow",
            signal: AbortSignal.timeout(5000),
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await appendLog(projectId, "health", `local fetch-failed: ${message}`);
        return {
            ok: false,
            htmlOk: false,
            statusCode: 0,
            contentType: "",
            latencyMs: Date.now() - start,
            error: `Health request failed: ${message}`,
            detail: `Could not reach http://127.0.0.1:${port}/`,
        };
    }
    const result = await readAndInspectResponse(projectId, `local http://127.0.0.1:${port}/`, response, start);
    return {
        ...result,
        detail: result.detail || `Could not reach http://127.0.0.1:${port}/`,
    };
}
function normalizeDomainOrUrl(domainOrUrl) {
    return domainOrUrl.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
}
function protocolForUrl(url) {
    return url.toLowerCase().startsWith("http://") ? "http" : "https";
}
export async function runPublicHealthCheck(projectId, domainOrUrl) {
    const domain = normalizeDomainOrUrl(domainOrUrl);
    const candidates = [`https://${domain}/`, `http://${domain}/`];
    const failures = [];
    for (const candidate of candidates) {
        const start = Date.now();
        let response;
        try {
            response = await fetch(candidate, {
                headers: { Accept: "text/html" },
                redirect: "follow",
                signal: AbortSignal.timeout(10000),
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const detail = `${candidate} fetch-failed: ${message}`;
            failures.push(detail);
            await appendLog(projectId, "health", `public ${detail}`);
            continue;
        }
        const result = await readAndInspectResponse(projectId, `public ${candidate}`, response, start);
        const url = response.url || candidate;
        const protocol = protocolForUrl(url);
        if (result.ok && result.htmlOk) {
            return {
                ...result,
                url,
                protocol,
            };
        }
        failures.push(`${candidate} ${result.error || result.detail || "failed"}`);
    }
    return {
        ok: false,
        htmlOk: false,
        statusCode: 0,
        contentType: "",
        latencyMs: 0,
        error: "Public subdomain is not reachable as valid HTML over HTTPS or HTTP",
        detail: failures.join(" | "),
        url: `https://${domain}`,
        protocol: "https",
    };
}
