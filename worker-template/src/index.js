export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Handle API requests
    // Example: /api/hello -> JSON response
    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({
        message: "Hello from the API!",
        timestamp: new Date().toISOString(),
        path: url.pathname
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. Serve Static Assets
    // env.ASSETS is available in Pages Functions or Workers Sites
    try {
      const response = await env.ASSETS.fetch(request);
      if (response.status >= 200 && response.status < 400) {
        return response;
      }
      // If 404, fall through to SPA handler
    } catch (e) {
      // Ignore error and fall through
    }

    // 3. SPA Fallback (Serve index.html for unknown routes)
    try {
      // Rewrite request to point to index.html
      const indexRequest = new Request(new URL('/index.html', request.url), request);
      return await env.ASSETS.fetch(indexRequest);
    } catch (e) {
      return new Response("Site Not Found", { status: 404 });
    }
  }
};
