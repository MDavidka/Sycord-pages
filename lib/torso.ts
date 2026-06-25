/**
 * Torso HTTP API client — a drop-in replacement for the MongoDB clientPromise.
 *
 * Environment:
 *   TORSO_URL    — Torso base URL, e.g.  https://api.torso.io/v1
 *   TORSO_TOKEN  — Bearer token for authentication
 *   TORSO_DB     — Database name (defaults to "sycord")
 *
 * The exported `torsoPromise` mimics the MongoDB driver API surface so that
 * existing route files can switch from:
 *   import clientPromise from "@/lib/mongodb"
 * to:
 *   import clientPromise from "@/lib/torso"
 * with zero changes to the call sites (db.collection().findOne, etc.).
 *
 * Operations implemented:
 *   findOne    → GET  /collections/:name/items?id_field=:value
 *   find       → GET  /collections/:name/items (query params for filter)
 *   updateOne  → PUT  /collections/:name/items/:id  or  POST /collections/:name/items (upsert)
 *   insertOne  → POST /collections/:name/items
 *   deleteOne → DELETE /collections/:name/items/:id
 *   deleteMany → POST /collections/:name/items/bulk-delete
 *
 * Projection is simulated client-side (field selection on the returned object).
 * $push / $pull / $setOnInsert on embedded arrays are handled by the
 * server-side Torso rules.
 */

const TORSO_URL = process.env.TORSO_URL?.replace(/\/$/, "");
const TORSO_TOKEN = process.env.TORSO_TOKEN;
const TORSO_DB = process.env.TORSO_DB || "sycord";

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

  const url = `${TORSO_URL}/api/databases/${TORSO_DB}${path}`;
  const { signal } = options;

  const res = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${TORSO_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: options.body != null ? JSON.stringify(options.body) : undefined,
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Torso API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Torso REST → MongoDB-like result shape
// ---------------------------------------------------------------------------

/** Strip internal Torso fields (_tid, _rev, etc.) from a returned item. */
function cleanItem(item: Record<string, unknown>): Record<string, unknown> {
  if (!item || typeof item !== "object") return item;
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item)) {
    if (k === "_tid" || k === "_rev" || k === "_ts") continue;
    cleaned[k] = v;
  }
  return cleaned;
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
    options?: { projection?: Record<string, unknown> }
  ): Promise<T | null> {
    const [field, value] = Object.entries(filter)[0] ?? [];
    const params = new URLSearchParams({
      [field]: String(value),
    });

    // Support multi-field filters by adding extra_params
    const extraFields = Object.entries(filter).slice(1);
    if (extraFields.length > 0) {
      extraFields.forEach(([k, v]) => {
        params.append("extra_params", `${k}=${encodeURIComponent(String(v))}`);
      });
    }

    const path = `/collections/${this.name}/items?${params.toString()}`;

    try {
      const data = await torsoFetch<{ items: T[] }>(path);
      const item = data?.items?.[0];
      if (!item) return null;
      const cleaned = cleanItem(item as Record<string, unknown>);
      return applyProjection(cleaned, options?.projection) as T;
    } catch (err) {
      console.error(`[torso] findOne ${this.name} error:`, err);
      throw err;
    }
  }

  /**
   * Find multiple documents.
   * Torso: GET /collections/:name/items
   */
  async find<T = Record<string, unknown>>(
    filter: Record<string, unknown> = {},
    options?: {
      projection?: Record<string, unknown>;
      limit?: number;
      skip?: number;
    }
  ): Promise<{ toArray(): Promise<T[]> }> {
    const params = new URLSearchParams();
    const collectionName = this.name;
    for (const [k, v] of Object.entries(filter)) {
      params.append("extra_params", `${k}=${encodeURIComponent(String(v))}`);
    }
    if (options?.limit) params.append("limit", String(options.limit));
    if (options?.skip) params.append("skip", String(options.skip));

    const query = params.toString();
    const path = `/collections/${this.name}/items${query ? `?${query}` : ""}`;

    return {
      async toArray(): Promise<T[]> {
        try {
          const data = await torsoFetch<{ items: T[] }>(path);
          const items = (data?.items ?? []).map((rawItem) => {
            const cleaned = cleanItem(rawItem as Record<string, unknown>);
            return applyProjection(cleaned, options?.projection) as T;
          });
          return items;
        } catch (err) {
          console.error(`[torso] find ${collectionName} error:`, err);
          throw err;
        }
      },
    };
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
      // Update existing document
      // Flatten $set, $push, $pull operations into a flat update payload
      const flatUpdate: Record<string, unknown> = {};
      let hasSet = false;
      let hasPushPull = false;

      const sets = update.$set as Record<string, unknown> | undefined;
      if (sets) {
        hasSet = true;
        for (const [k, v] of Object.entries(sets)) {
          flatUpdate[k] = v;
        }
      }

      // For $push / $pull on embedded arrays, we need to handle them specially
      const pushOps = update.$push as Record<string, unknown> | undefined;
      const pullOps = update.$pull as Record<string, unknown> | undefined;

      if (pushOps || pullOps) {
        hasPushPull = true;
        // Merge existing doc with pushes/pulls
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
            // Simple pull by matching object fields
            merged[k] = existing.filter((item: unknown) => {
              if (typeof v !== "object" || v === null) return true;
              return !Object.entries(v as Record<string, unknown>).every(
                ([pk, pv]) => (item as Record<string, unknown>)[pk] === pv
              );
            });
          }
        }

        // Apply $set on top
        if (sets) {
          for (const [k, v] of Object.entries(sets)) {
            merged[k] = v;
          }
        }

        // PUT full document with merged state
        try {
          await torsoFetch(`/collections/${this.name}/items/${doc._tid}`, {
            method: "PUT",
            body: { ...merged, updatedAt: now },
          });
          return { matchedCount: 1, modifiedCount: 1 };
        } catch (err) {
          console.error(`[torso] updateOne ${this.name} error:`, err);
          throw err;
        }
      }

      // Pure $set update
      const merged = { ...doc };
      if (sets) {
        for (const [k, v] of Object.entries(sets)) {
          merged[k] = v;
        }
      }
      merged.updatedAt = now;

      try {
        await torsoFetch(`/collections/${this.name}/items/${doc._tid}`, {
          method: "PUT",
          body: merged,
        });
        return { matchedCount: 1, modifiedCount: hasSet ? 1 : 0 };
      } catch (err) {
        console.error(`[torso] updateOne ${this.name} error:`, err);
        throw err;
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
        const created = await torsoFetch<{ _tid: string }>(
          `/collections/${this.name}/items`,
          { method: "POST", body: newDoc }
        );
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
      } catch (err) {
        console.error(`[torso] upsert ${this.name} error:`, err);
        throw err;
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
      const result = await torsoFetch<{ _tid: string }>(
        `/collections/${this.name}/items`,
        { method: "POST", body: withTimestamps }
      );
      return { insertedId: result._tid };
    } catch (err) {
      console.error(`[torso] insertOne ${this.name} error:`, err);
      throw err;
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
      throw err;
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
      const data = await torsoFetch<{ deleted: number }>(
        `/collections/${this.name}/items/bulk-delete?${params.toString()}`,
        { method: "POST" }
      );
      return { deletedCount: data?.deleted ?? 0 };
    } catch (err) {
      console.error(`[torso] deleteMany ${this.name} error:`, err);
      throw err;
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
  if (!TORSO_URL || !TORSO_TOKEN) {
    return Promise.reject(
      new Error("Missing TORSO_URL or TORSO_TOKEN environment variables.")
    );
  }

  // Lightweight health check — verify the token works
  return torsoFetch<{ ok: boolean }>("/info")
    .then(() => {
      console.log("[torso] Connected to Torso database:", TORSO_DB);
      return { db: () => new TorsoDatabase() };
    })
    .catch((err) => {
      console.error("[torso] Failed to connect to Torso:", err?.message);
      throw err;
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

export { TorsoDatabase, TorsoCollection };
export default torsoPromise;
