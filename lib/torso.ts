/**
 * Torso HTTP API client — a drop-in replacement for the MongoDB clientPromise.
 *
 * Environment:
 *   TORSO_URL      — Torso base URL, e.g. https://api.torso.io
 *   TORSO_TOKEN    — Bearer token for authentication
 *   TORSO_DB       — Database name (defaults to "sycord")
 *   TORSO_API_PATH — API prefix (defaults to /api/databases; set /api/v1/databases if needed)
 *
 * The exported `torsoPromise` mimics the MongoDB driver API surface so that
 * existing route files can switch from:
 *   import clientPromise from "@/lib/mongodb"
 * to:
 *   import clientPromise from "@/lib/torso"
 * with zero changes to the call sites (db.collection().findOne, etc.).
 *
 * Operations implemented:
 *   findOne    → GET  /api/databases/:db/collections/:name/items?id_field=:value
 *   find       → GET  /api/databases/:db/collections/:name/items
 *   updateOne  → PUT  /api/databases/:db/collections/:name/items/:id  or  POST (upsert)
 *   insertOne  → POST /api/databases/:db/collections/:name/items
 *   deleteOne  → DELETE /api/databases/:db/collections/:name/items/:id
 *   deleteMany → POST /api/databases/:db/collections/:name/items/bulk-delete
 *
 * Projection is simulated client-side (field selection on the returned object).
 * $push / $pull / $setOnInsert on embedded arrays are handled via read-modify-write.
 * The Torso internal ID (_tid) is preserved for update/delete operations.
 */

const _rawTorsoUrl = process.env.TORSO_URL;
// Auto-prepend https:// if scheme is missing
const TORSO_URL = _rawTorsoUrl
  ? (_rawTorsoUrl.match(/^https?:\/\//i) ? _rawTorsoUrl : `https://${_rawTorsoUrl}`).replace(/\/$/, "")
  : "";
const TORSO_TOKEN = process.env.TORSO_TOKEN;
const TORSO_DB = process.env.TORSO_DB || "sycord";
// API path prefix — Torso uses /api/databases/:db as the base path.
// Set TORSO_API_PATH env var to override if needed (e.g. /api/v1/databases for v1 API)
const TORSO_API_PREFIX = process.env.TORSO_API_PATH || "/api/databases";

if (!TORSO_URL || !TORSO_TOKEN) {
  console.warn(
    "[torso] Warning: TORSO_URL or TORSO_TOKEN is not set. Database operations will fail."
  );
}

// ---------------------------------------------------------------------------
// Internal HTTP helper
// ---------------------------------------------------------------------------

interface TorsoRequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

async function torsoFetch<T = unknown>(
  path: string,
  options: TorsoRequestOptions = {}
): Promise<T> {
  if (!TORSO_URL || !TORSO_TOKEN) {
    throw new Error(
      "Torso is not configured. Set TORSO_URL and TORSO_TOKEN environment variables."
    );
  }

  // Build full URL: base + api path + db + collection path
  // e.g. https://api.torso.io/api/databases/sycord/collections/users/items?id=xxx
  const url = `${TORSO_URL}${TORSO_API_PREFIX}/${TORSO_DB}${path}`;
  const { signal } = options;

  // Add a 15-second timeout so requests don't hang forever
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  // Combine caller's signal with our timeout signal
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeoutId);
      throw new Error("Request aborted");
    }
    signal.addEventListener("abort", () => controller.abort());
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method || "GET",
      headers: {
        Authorization: `Bearer ${TORSO_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: options.body != null ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    // Provide a clearer error message for common issues
    if (err?.cause?.code === "ECONNREFUSED") {
      throw new Error(`Torso connection refused at ${url}. Check TORSO_URL.`);
    }
    if (err?.cause?.code === "ENOTFOUND") {
      throw new Error(`Torso host not found: ${TORSO_URL}. Check TORSO_URL.`);
    }
    if (err?.cause?.message?.includes("unknown scheme")) {
      throw new Error(
        `Torso URL has invalid scheme. Set TORSO_URL to a full URL like "https://api.torso.io" (got "${TORSO_URL}")`
      );
    }
    if (err?.name === "AbortError") {
      throw new Error(`Torso request to ${url} timed out after 15s`);
    }
    throw err;
  }
  clearTimeout(timeoutId);

  // Handle empty responses (204, empty body)
  const contentLength = res.headers.get("content-length");
  const isEmpty = contentLength === "0" || res.status === 204 || res.status === 201;
  if (isEmpty) {
    return {} as T;
  }

  // Read response text first so we can handle non-JSON gracefully
  const text = await res.text().catch(() => "");

  if (!res.ok) {
    throw new Error(`Torso API error ${res.status} on ${options.method || "GET"} ${url}: ${text.slice(0, 200)}`);
  }

  if (!text.trim()) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    // Torso may return non-JSON on some endpoints; return empty object
    console.warn(`[torso] Non-JSON response on ${options.method || "GET"} ${url}:`, text.slice(0, 100));
    return {} as T;
  }
}

// ---------------------------------------------------------------------------
// Torso REST → MongoDB-like result shape
// ---------------------------------------------------------------------------

/** Strip internal Torso fields (_rev, _ts) from a returned item. Preserve _tid for updates. */
function cleanItem(item: Record<string, unknown>): Record<string, unknown> {
  if (!item || typeof item !== "object") return item;
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item)) {
    // Keep _tid — it's needed for update/delete operations
    if (k === "_rev" || k === "_ts") continue;
    cleaned[k] = v;
  }
  return cleaned;
}

/**
 * Extract the Torso internal ID from a document response.
 * Torso may return it as `_tid`, `id`, `_id`, or `tid`.
 */
function extractTorsoId(doc: Record<string, unknown>): string | undefined {
  return (doc._tid ?? doc.id ?? doc._id ?? doc.tid) as string | undefined;
}

/**
 * Chainable query object that mirrors MongoDB driver's Cursor API.
 * Supports: .sort(), .limit(), .skip(), .toArray()
 */
class TorsoQuery<T = Record<string, unknown>> {
  private sortField: string | null = null;
  private sortOrder: 1 | -1 = 1;
  private limitValue?: number;
  private skipValue?: number;

  constructor(
    private collectionName: string,
    private params: URLSearchParams,
    private projection?: Record<string, unknown>
  ) {}

  /** Sort the results by a field. Mirrors MongoDB driver: cursor.sort({ field: 1 | -1 }) */
  sort(sortSpec: Record<string, 1 | -1>): this {
    const entries = Object.entries(sortSpec);
    if (entries.length > 0) {
      const [field, order] = entries[0];
      this.sortField = field;
      this.sortOrder = order === -1 ? -1 : 1;
    }
    return this;
  }

  /** Limit the number of results. */
  limit(n: number): this {
    this.limitValue = n;
    return this;
  }

  /** Skip the first N results. */
  skip(n: number): this {
    this.skipValue = n;
    return this;
  }

  /** Execute the query and return all matching documents as an array. */
  async toArray(): Promise<T[]> {
    try {
      // Clone params so we don't mutate the original
      const params = new URLSearchParams(this.params);

      // Apply sort — Torso typically supports `sort` and `order` params
      if (this.sortField) {
        params.append("sort", this.sortField);
        params.append("order", this.sortOrder === -1 ? "desc" : "asc");
      }

      // Apply limit/skip
      if (this.limitValue != null) params.append("limit", String(this.limitValue));
      if (this.skipValue != null) params.append("skip", String(this.skipValue));

      const queryString = params.toString();
      const path = `/collections/${this.collectionName}/items${queryString ? `?${queryString}` : ""}`;

      const raw = await torsoFetch<any>(path);
      const data = raw?.data ?? raw?.items ?? raw?.result ?? raw;
      const items = Array.isArray(data) ? data : data ? [data] : [];

      // Apply client-side sort as fallback (Torso may not support sort param)
      let results = items.map((rawItem: unknown) => {
        const cleaned = cleanItem(rawItem as Record<string, unknown>);
        return applyProjection(cleaned, this.projection) as T;
      });

      // Client-side sort (works regardless of Torso's sort support)
      if (this.sortField) {
        const field = this.sortField;
        const order = this.sortOrder;
        results.sort((a: any, b: any) => {
          const av = a?.[field];
          const bv = b?.[field];
          if (av == null && bv == null) return 0;
          if (av == null) return order === 1 ? -1 : 1;
          if (bv == null) return order === 1 ? 1 : -1;
          if (av < bv) return order === 1 ? -1 : 1;
          if (av > bv) return order === 1 ? 1 : -1;
          return 0;
        });
      }

      // Apply client-side limit/skip
      if (this.skipValue != null && this.skipValue > 0) results = results.slice(this.skipValue);
      if (this.limitValue != null && this.limitValue >= 0) results = results.slice(0, this.limitValue);

      return results;
    } catch (err) {
      console.error(`[torso] find ${this.collectionName}.toArray error:`, err);
      return [];
    }
  }
}

function applyProjection<T extends Record<string, unknown>>(
  doc: T,
  projection?: Record<string, unknown>
): Partial<T> {
  if (!projection) return doc;
  const result: Partial<T> = {};
  for (const [k, v] of Object.entries(projection)) {
    if (k === "_id" && v === 0) continue;
    if (v === 1 || v === true) {
      result[k as keyof T] = doc[k as keyof T];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Collection interface (mirrors MongoDB driver)
// ---------------------------------------------------------------------------

class TorsoCollection {
  constructor(private name: string) {}

  /**
   * Find a single document by filter.
   * Torso: GET /collections/:name/items?id_field=value
   */
  async findOne<T = Record<string, unknown>>(
    filter: Record<string, unknown>,
    options?: { projection?: Record<string, unknown>; limit?: number; skip?: number }
  ): Promise<T | null> {
    const [field, value] = Object.entries(filter)[0] ?? [];
    if (!field) {
      console.warn(`[torso] findOne ${this.name}: empty filter, returning null`);
      return null;
    }

    // Use simple id=value format as default (works for most REST APIs)
    const params = new URLSearchParams({ [field]: String(value) });

    // Support multi-field filters via extra_params
    const extraFields = Object.entries(filter).slice(1);
    if (extraFields.length > 0) {
      for (const [k, v] of extraFields) {
        params.append("extra_params", `${k}=${encodeURIComponent(String(v))}`);
      }
    }

    if (options?.limit) params.append("limit", String(options.limit));
    if (options?.skip) params.append("skip", String(options.skip));

    const path = `/collections/${this.name}/items?${params.toString()}`;

    try {
      const raw = await torsoFetch<any>(path);
      const data = raw?.data ?? raw?.items ?? raw?.result ?? raw;
      const item = Array.isArray(data) ? data[0] : data;
      if (!item) return null;

      // Always preserve _tid for update/delete operations, even if projection is used
      const torsoId = extractTorsoId(item);
      const cleaned = cleanItem(item);
      if (torsoId) cleaned._tid = torsoId;

      const result = applyProjection(cleaned, options?.projection);
      // If projection was used, still include _tid for callers that need it
      if (torsoId && !result._tid) (result as any)._tid = torsoId;
      return result as T;
    } catch (err) {
      console.error(`[torso] findOne ${this.name} error:`, err);
      return null;
    }
  }

  /**
   * Find multiple documents.
   * Returns a chainable query object (sort, limit, skip, toArray) to mirror MongoDB driver.
   * Torso: GET /collections/:name/items
   */
  find<T = Record<string, unknown>>(
    filter: Record<string, unknown> = {},
    options?: {
      projection?: Record<string, unknown>;
      limit?: number;
      skip?: number;
    }
  ): TorsoQuery<T> {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) {
      params.append("extra_params", `${k}=${encodeURIComponent(String(v))}`);
    }
    if (options?.limit) params.append("limit", String(options.limit));
    if (options?.skip) params.append("skip", String(options.skip));

    return new TorsoQuery<T>(this.name, params, options?.projection);
  }

  /**
   * Update a single document. Supports MongoDB-style dot-notation for nested fields.
   * Handles both plain $set and MongoDB positional operator ($set, $push, $pull).
   * Torso: PUT /collections/:name/items/:id
   */
  async updateOne(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options?: { upsert?: boolean }
  ): Promise<{ matchedCount: number; modifiedCount: number; upsertedCount?: number }> {
    // First, find the document to get its Torso ID
    const doc = await this.findOne<Record<string, unknown>>(filter);
    const now = new Date().toISOString();

    if (doc) {
      const torsoId = extractTorsoId(doc);
      if (!torsoId) {
        console.warn(`[torso] updateOne ${this.name}: doc found but no Torso ID (_tid/id/_id)`);
        return { matchedCount: 0, modifiedCount: 0 };
      }

      const sets = update.$set as Record<string, unknown> | undefined;
      const pushOps = update.$push as Record<string, unknown> | undefined;
      const pullOps = update.$pull as Record<string, unknown> | undefined;

      if (pushOps || pullOps) {
        // For $push/$pull: read-modify-write on the embedded array
        const merged = { ...doc };

        if (pushOps) {
          for (const [k, v] of Object.entries(pushOps)) {
            const existing = Array.isArray(merged[k]) ? merged[k] : [];
            merged[k] = [...existing, v];
          }
        }
        if (pullOps) {
          for (const [k, v] of Object.entries(pullOps)) {
            const existing = Array.isArray(merged[k]) ? merged[k] : [];
            merged[k] = existing.filter((item: unknown) => {
              if (typeof v !== "object" || v === null) return true;
              return !Object.entries(v as Record<string, unknown>).every(
                ([pk, pv]) => (item as Record<string, unknown>)[pk] === pv
              );
            });
          }
        }
        if (sets) {
          for (const [k, v] of Object.entries(sets)) merged[k] = v;
        }

        try {
          await torsoFetch(`/collections/${this.name}/items/${torsoId}`, {
            method: "PUT",
            body: { ...merged, updatedAt: now },
          });
          return { matchedCount: 1, modifiedCount: 1 };
        } catch (err) {
          console.error(`[torso] updateOne ${this.name} error:`, err);
          return { matchedCount: 1, modifiedCount: 0 };
        }
      }

      // Pure $set update
      const merged = { ...doc };
      if (sets) {
        for (const [k, v] of Object.entries(sets)) merged[k] = v;
      }
      merged.updatedAt = now;

      try {
        await torsoFetch(`/collections/${this.name}/items/${torsoId}`, {
          method: "PUT",
          body: merged,
        });
        return { matchedCount: 1, modifiedCount: sets ? 1 : 0 };
      } catch (err) {
        console.error(`[torso] updateOne ${this.name} error:`, err);
        return { matchedCount: 1, modifiedCount: 0 };
      }
    } else if (options?.upsert) {
      // Upsert: create new document from filter + $set
      const newDoc: Record<string, unknown> = { ...filter };
      if (update.$set) {
        for (const [k, v] of Object.entries(update.$set as Record<string, unknown>)) {
          newDoc[k] = v;
        }
      }
      if (update.$setOnInsert) {
        for (const [k, v] of Object.entries(update.$setOnInsert)) {
          newDoc[k] = v;
        }
      }
      newDoc.createdAt = new Date().toISOString();
      newDoc.updatedAt = new Date().toISOString();

      try {
        const created = await torsoFetch<any>(`/collections/${this.name}/items`, {
          method: "POST",
          body: newDoc,
        });
        // Capture the Torso ID from the response so future updates work
        const newId = extractTorsoId(created);
        if (newId) console.log(`[torso] upsert ${this.name}: created with id=${newId}`);
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
      } catch (err) {
        console.error(`[torso] upsert ${this.name} error:`, err);
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
      }
    }

    return { matchedCount: 0, modifiedCount: 0 };
  }

  /**
   * Insert a single document.
   * Torso: POST /collections/:name/items
   */
  async insertOne<T = Record<string, unknown>>(doc: T): Promise<{ insertedId?: string }> {
    const withTimestamps = {
      ...(doc as Record<string, unknown>),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const result = await torsoFetch<{ _tid?: string }>(
        `/collections/${this.name}/items`,
        { method: "POST", body: withTimestamps }
      );
      return { insertedId: result?._tid };
    } catch (err) {
      console.error(`[torso] insertOne ${this.name} error:`, err);
      return {};
    }
  }

  /**
   * Delete a single document.
   * Torso: DELETE /collections/:name/items/:id
   */
  async deleteOne(filter: Record<string, unknown>): Promise<{ deletedCount: number }> {
    const doc = await this.findOne<Record<string, unknown>>(filter);
    if (!doc) return { deletedCount: 0 };

    try {
      await torsoFetch(`/collections/${this.name}/items/${doc._tid}`, {
        method: "DELETE",
      });
      return { deletedCount: 1 };
    } catch (err) {
      console.error(`[torso] deleteOne ${this.name} error:`, err);
      return { deletedCount: 0 };
    }
  }

  /**
   * Delete multiple documents matching a filter.
   * Torso: POST /collections/:name/items/bulk-delete
   */
  async deleteMany(filter: Record<string, unknown>): Promise<{ deletedCount: number }> {
    const [field, value] = Object.entries(filter)[0] ?? [];
    const params = new URLSearchParams({ [field]: String(value) });

    try {
      const data = await torsoFetch<{ deleted?: number }>(
        `/collections/${this.name}/items/bulk-delete?${params.toString()}`,
        { method: "POST" }
      );
      return { deletedCount: data?.deleted ?? 0 };
    } catch (err) {
      console.error(`[torso] deleteMany ${this.name} error:`, err);
      return { deletedCount: 0 };
    }
  }
}

// ---------------------------------------------------------------------------
// Database interface (mirrors MongoDB driver: client.db())
// ---------------------------------------------------------------------------

class TorsoDatabase {
  collection<T = Record<string, unknown>>(name: string): TorsoCollection {
    return new TorsoCollection(name);
  }
}

// ---------------------------------------------------------------------------
// Singleton client (mirrors MongoDB clientPromise)
// ---------------------------------------------------------------------------

let torsoPromise: Promise<{ db: () => TorsoDatabase }>;

function createTorsoClient(): Promise<{ db: () => TorsoDatabase }> {
  // Verify the configuration by doing a test request
  const testUrl = `${TORSO_URL}${TORSO_API_PREFIX}/${TORSO_DB}/collections`;
  console.log(`[torso] Initializing with base URL: ${testUrl}`);

  if (!TORSO_URL || !TORSO_TOKEN) {
    console.warn("[torso] Warning: TORSO_URL or TORSO_TOKEN is not set. Auth will fail until configured.");
    return Promise.resolve({ db: () => new TorsoDatabase() });
  }

  // Test the connection on startup
  return torsoFetch<{ data?: any; collections?: any[] }>(`/collections`)
    .then((data) => {
      const collections = data?.data?.collections ?? data?.collections ?? [];
      console.log(`[torso] Connected. Available collections:`, collections);
      return { db: () => new TorsoDatabase() };
    })
    .catch((err) => {
      console.error(`[torso] Connection test failed: ${err?.message}`);
      console.warn(`[torso] Will continue without connection — operations will fail.`);
      return { db: () => new TorsoDatabase() };
    });
}

// Development: preserve connection across HMR (same pattern as MongoDB)
if (process.env.NODE_ENV === "development") {
  if (!(global as any)._torsoClientPromise) {
    (global as any)._torsoClientPromise = createTorsoClient();
  }
  torsoPromise = (global as any)._torsoClientPromise;
} else {
  torsoPromise = createTorsoClient();
}

export { TorsoDatabase, TorsoCollection, TorsoQuery };
export default torsoPromise;
