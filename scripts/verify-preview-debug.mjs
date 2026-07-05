/**
 * Lightweight verification for preview blank-screen diagnosis helpers.
 * Run: node scripts/verify-preview-debug.mjs
 */

const PROXY_ERROR_PATTERNS = [
  "Unauthorized",
  "Missing url param",
  "Bad url encoding",
  "URL not allowed",
  "Preview server unreachable",
];

function detectProxyErrorText(bodyText) {
  const trimmed = bodyText.trim();
  if (!trimmed) return null;
  for (const pattern of PROXY_ERROR_PATTERNS) {
    if (trimmed.startsWith(pattern) || trimmed.includes(pattern)) {
      return trimmed.slice(0, 300);
    }
  }
  return null;
}

function diagnose(bodyText, bodyHtml, rootChildCount = 0) {
  const proxyErrorText = detectProxyErrorText(bodyText || bodyHtml);
  const looksBlank =
    proxyErrorText
      ? true
      : bodyText.length < 20 && rootChildCount === 0 && bodyHtml.length < 200;
  return { proxyErrorText, looksBlank };
}

const cases = [
  {
    name: "proxy_unauthorized",
    bodyText: "Unauthorized",
    bodyHtml: "",
    expectReason: "proxy_error",
  },
  {
    name: "upstream_unreachable",
    bodyText: "Preview server unreachable: timeout",
    bodyHtml: "",
    expectReason: "proxy_error",
  },
  {
    name: "empty_body",
    bodyText: "",
    bodyHtml: "",
    expectReason: "blank",
  },
  {
    name: "vite_shell",
    bodyText: "",
    bodyHtml: "<div id=\"root\"></div><script src=\"/@vite/client\"></script>",
    rootChildCount: 0,
    expectReason: "blank",
  },
  {
    name: "healthy_app",
    bodyText: "Hello World",
    bodyHtml: "<div id=\"root\"><h1>Hello World</h1></div>",
    rootChildCount: 1,
    expectReason: "ok",
  },
];

let failed = 0;
for (const c of cases) {
  const result = diagnose(c.bodyText ?? "", c.bodyHtml ?? "", c.rootChildCount ?? 0);
  const reason = result.proxyErrorText
    ? "proxy_error"
    : result.looksBlank
      ? "blank"
      : "ok";
  const pass = reason === c.expectReason;
  console.log(`${pass ? "PASS" : "FAIL"} ${c.name}: got ${reason}, expected ${c.expectReason}`);
  if (!pass) failed += 1;
}

function describeSytePreviewUrlSource(data) {
  if (!data || typeof data !== "object") return { url: null, source: "none" };
  const domainUrl =
    typeof data.preview_domain_url === "string" ? data.preview_domain_url.trim() : "";
  if (domainUrl.startsWith("http")) return { url: domainUrl, source: "preview_domain_url" };
  const previewDomain =
    typeof data.preview_domain === "string" ? data.preview_domain.trim() : "";
  if (previewDomain) {
    return { url: `https://${previewDomain.replace(/^https?:\/\//, "")}`, source: "preview_domain" };
  }
  const directUrl =
    typeof data.preview_direct_url === "string" ? data.preview_direct_url.trim() : "";
  if (directUrl.startsWith("http")) return { url: directUrl, source: "preview_direct_url" };
  return { url: null, source: "none" };
}

const urlCase = describeSytePreviewUrlSource({
  preview_domain_url: "https://preview-abc.sycord.com",
});
console.log(
  `${urlCase.source === "preview_domain_url" ? "PASS" : "FAIL"} url_source: ${urlCase.source}`,
);
if (urlCase.source !== "preview_domain_url") failed += 1;

if (failed > 0) {
  console.error(`\n${failed} verification check(s) failed`);
  process.exit(1);
}

console.log("\nAll preview debug verification checks passed.");
