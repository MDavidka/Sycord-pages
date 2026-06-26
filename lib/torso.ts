import { createClient, type Client, type InValue } from "@libsql/client";

/**
 * Turso-backed document adapter that preserves the Mongo-like API surface used
 * throughout the app (`db.collection().findOne()`, `.find().sort().toArray()`,
 * `.updateOne()` with `$set/$push/$pull`, etc.).
 *
 * Each collection is stored as a Turso/SQLite table with a JSON `doc` column.
 * Querying and mutation semantics that MongoDB provided are emulated in
 * TypeScript so the rest of the codebase does not need to change.
 */

type AnyDoc = Record<string, any>;
type Projection = Record<string, unknown>;
type UpdateFilter = Record<string, unknown>;

interface FindOptions {
  projection?: Projection;
  limit?: number;
  skip?: number;
}

interface UpdateOptions {
  upsert?: boolean;
  arrayFilters?: Record<string, unknown>[];
}

const RAW_TORSO_URL = (process.env.TORSO_URL || "").trim();
const TORSO_URL = normalizeTorsoUrl(RAW_TORSO_URL);
const TORSO_TOKEN = process.env.TORSO_TOKEN || process.env.TURSO_AUTH_TOKEN || "";

if (!TORSO_URL || !TORSO_TOKEN) {
  console.warn("[torso] Warning: TORSO_URL or TORSO_TOKEN is not set. Database operations will fail.");
}

function normalizeTorsoUrl(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim().replace(/\/$/, "");
  if (/^(libsql|https?|wss?):\/\//i.test(trimmed) || /^file:/i.test(trimmed)) return trimmed;
  if (/turso\.io$/i.test(trimmed) || /\.turso\.io$/i.test(trimmed)) return `libsql://${trimmed}`;
  return `https://${trimmed}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

function cloneValue<T>(value: T): T {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => normalizeValue(item));
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = normalizeValue(inner);
    }
    return out;
  }
  return value;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizeValue(a)) === JSON.stringify(normalizeValue(b));
}

function extractTorsoId(doc: Record<string, unknown>): string | undefined {
  return (doc._tid ?? doc.id ?? doc._id ?? doc.tid) as string | undefined;
}

function cleanItem(item: Record<string, unknown>): Record<string, unknown> {
  if (!item || typeof item !== "object") return item;
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item)) {
    cleaned[k] = normalizeValue(v);
  }
  return cleaned;
}

function isOperatorObject(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value) && Object.keys(value).some((key) => key.startsWith("$"));
}

function getValuesAtPath(value: unknown, segments: string[]): unknown[] {
  if (segments.length === 0) return [value];
  if (value == null) return [undefined];

  if (Array.isArray(value)) {
    return value.flatMap((item) => getValuesAtPath(item, segments));
  }

  if (!isPlainObject(value)) return [undefined];

  const [head, ...rest] = segments;
  return getValuesAtPath(value[head], rest);
}

function getDirectValueAtPath(value: unknown, path: string): unknown {
  const segments = path.split(".");
  let current: any = value;
  for (const segment of segments) {
    if (current == null) return undefined;
    current = current[segment];
  }
  return current;
}

function setDirectValueAtPath(target: AnyDoc, path: string, value: unknown) {
  const segments = path.split(".");
  let current: AnyDoc = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    if (!isPlainObject(current[segment])) current[segment] = {};
    current = current[segment] as AnyDoc;
  }
  current[segments[segments.length - 1]] = cloneValue(value);
}

function matchesCondition(values: unknown[], expected: unknown): boolean {
  if (isOperatorObject(expected)) {
    if ("$exists" in expected) {
      const present = values.some((value) => value !== undefined);
      return expected.$exists ? present : !present;
    }

    if ("$elemMatch" in expected) {
      return values.some(
        (value) =>
          Array.isArray(value) &&
          value.some((item) => isPlainObject(item) && matchFilter(item, expected.$elemMatch as Record<string, unknown>)),
      );
    }
  }

  return values.some((value) => deepEqual(value, expected));
}

function matchFilter(doc: AnyDoc, filter: UpdateFilter): boolean {
  for (const [key, expected] of Object.entries(filter)) {
    if (key === "$or" && Array.isArray(expected)) {
      if (!(expected as unknown[]).some((part) => isPlainObject(part) && matchFilter(doc, part as UpdateFilter))) {
        return false;
      }
      continue;
    }

    if (key === "$and" && Array.isArray(expected)) {
      if (!(expected as unknown[]).every((part) => isPlainObject(part) && matchFilter(doc, part as UpdateFilter))) {
        return false;
      }
      continue;
    }

    const values = getValuesAtPath(doc, key.split("."));
    if (!matchesCondition(values, expected)) {
      return false;
    }
  }
  return true;
}

interface MutationContext {
  positional: Record<string, number>;
  arrayFilters: Record<string, unknown>[];
}

function buildMutationContext(doc: AnyDoc, filter: UpdateFilter, options?: UpdateOptions): MutationContext {
  const positional: Record<string, number> = {};

  for (const [key, expected] of Object.entries(filter)) {
    if (key === "$or" || key === "$and") continue;

    if (isOperatorObject(expected) && "$elemMatch" in expected) {
      const arrayValue = (doc as AnyDoc)[key];
      if (Array.isArray(arrayValue) && positional[key] == null) {
        const idx = arrayValue.findIndex((item) => isPlainObject(item) && matchFilter(item, expected.$elemMatch as UpdateFilter));
        if (idx >= 0) positional[key] = idx;
      }
      continue;
    }

    const [head, ...rest] = key.split(".");
    const rootValue = (doc as AnyDoc)[head];
    if (!Array.isArray(rootValue) || positional[head] != null || rest.length === 0) continue;

    const idx = rootValue.findIndex((item) => matchesCondition(getValuesAtPath(item, rest), expected));
    if (idx >= 0) positional[head] = idx;
  }

  return {
    positional,
    arrayFilters: options?.arrayFilters ?? [],
  };
}

function resolveArrayFilterIndex(
  items: unknown[],
  identifier: string,
  arrayFilters: Record<string, unknown>[],
): number {
  const relevant = arrayFilters
    .flatMap((entry) =>
      Object.entries(entry)
        .filter(([key]) => key === identifier || key.startsWith(`${identifier}.`))
        .map(([key, value]) => [key === identifier ? "" : key.slice(identifier.length + 1), value] as const),
    )
    .filter(([key]) => key.length > 0);

  if (relevant.length === 0) return -1;

  const filter: Record<string, unknown> = {};
  for (const [path, value] of relevant) {
    filter[path] = value;
  }

  return items.findIndex((item) => isPlainObject(item) && matchFilter(item, filter));
}

function isArrayToken(segment: string): boolean {
  return segment === "$" || segment === "$[]" || /^\$\[[^\]]+\]$/.test(segment);
}

function applySetLikeMutation(
  current: any,
  segments: string[],
  value: unknown,
  context: MutationContext,
  mode: "set" | "push" | "pull",
  currentArrayName?: string,
): boolean {
  if (segments.length === 0) return false;

  const [segment, ...rest] = segments;

  if (isArrayToken(segment)) {
    if (!Array.isArray(current)) return false;

    if (segment === "$") {
      const index = currentArrayName ? context.positional[currentArrayName] : undefined;
      if (index == null || index < 0 || index >= current.length) return false;
      return applySetLikeMutation(current[index], rest, value, context, mode, currentArrayName);
    }

    if (segment === "$[]") {
      let changed = false;
      for (const item of current) {
        changed = applySetLikeMutation(item, rest, value, context, mode, currentArrayName) || changed;
      }
      return changed;
    }

    const identifier = segment.slice(2, -1);
    const index = resolveArrayFilterIndex(current, identifier, context.arrayFilters);
    if (index < 0) return false;
    return applySetLikeMutation(current[index], rest, value, context, mode, currentArrayName);
  }

  if (!isPlainObject(current) && !Array.isArray(current)) return false;
  const currentRecord = current as AnyDoc;

  if (rest.length === 0) {
    if (mode === "set") {
      const nextValue = cloneValue(normalizeValue(value));
      if (deepEqual(currentRecord[segment], nextValue)) return false;
      currentRecord[segment] = nextValue;
      return true;
    }

    if (mode === "push") {
      if (!Array.isArray(currentRecord[segment])) currentRecord[segment] = [];
      currentRecord[segment].push(cloneValue(normalizeValue(value)));
      return true;
    }

    if (!Array.isArray(currentRecord[segment])) return false;
    const before = currentRecord[segment].length;
    currentRecord[segment] = currentRecord[segment].filter((item: unknown) => !matchPullCondition(item, value));
    return currentRecord[segment].length !== before;
  }

  if (currentRecord[segment] == null) {
    currentRecord[segment] = isArrayToken(rest[0]) ? [] : {};
  }

  return applySetLikeMutation(currentRecord[segment], rest, value, context, mode, segment);
}

function matchPullCondition(item: unknown, condition: unknown): boolean {
  if (isPlainObject(condition)) {
    return matchFilter(item as AnyDoc, condition);
  }
  return deepEqual(item, condition);
}

function applyProjection<T extends AnyDoc>(
  doc: T,
  projection?: Projection,
  filter?: UpdateFilter,
): Partial<T> {
  if (!projection) return cloneValue(doc);

  const includeEntries = Object.entries(projection).filter(([, value]) => value === 1 || value === true);
  const excludeEntries = Object.entries(projection).filter(([, value]) => value === 0 || value === false);

  if (includeEntries.length === 0) {
    const result = cloneValue(doc);
    for (const [key] of excludeEntries) {
      if (!key.includes(".")) delete (result as AnyDoc)[key];
    }
    return result as Partial<T>;
  }

  const result: AnyDoc = {};
  const context = filter ? buildMutationContext(doc, filter) : { positional: {}, arrayFilters: [] };

  for (const [key] of includeEntries) {
    if (key.endsWith(".$")) {
      const arrayField = key.slice(0, -2);
      const source = (doc as AnyDoc)[arrayField];
      const idx = context.positional[arrayField];
      if (Array.isArray(source) && idx != null && idx >= 0 && idx < source.length) {
        result[arrayField] = [cloneValue(source[idx])];
      }
      continue;
    }

    const value = getDirectValueAtPath(doc, key);
    if (value !== undefined) {
      setDirectValueAtPath(result, key, value);
    }
  }

  if (doc._tid && !result._tid) result._tid = doc._tid;
  return result as Partial<T>;
}

let sqlClient: Client | null = null;
const ensuredTables = new Set<string>();

function getSqlClient(): Client {
  if (!TORSO_URL) {
    throw new Error("Torso is not configured. Set TORSO_URL.");
  }

  if (!sqlClient) {
    sqlClient = createClient({
      url: TORSO_URL,
      authToken: TORSO_TOKEN || undefined,
    });
  }

  return sqlClient;
}

function tableNameForCollection(name: string): string {
  return `docs_${name.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function isSimpleSqlField(field: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(field);
}

async function ensureCollectionTable(collectionName: string) {
  const tableName = tableNameForCollection(collectionName);
  if (ensuredTables.has(tableName)) return;

  const client = getSqlClient();
  const quoted = quoteIdentifier(tableName);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS ${quoted} (
      _tid TEXT PRIMARY KEY,
      doc TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS ${quoteIdentifier(`${tableName}_updated_at_idx`)}
    ON ${quoted}(updated_at)
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS ${quoteIdentifier(`${tableName}_created_at_idx`)}
    ON ${quoted}(created_at)
  `);

  ensuredTables.add(tableName);
}

function canUseSqlFilter(filter: UpdateFilter): boolean {
  return Object.entries(filter).every(
    ([key, value]) => isSimpleSqlField(key) && !isOperatorObject(value) && !Array.isArray(value) && !isPlainObject(value),
  );
}

function canUseSqlSort(field?: string | null): boolean {
  return !!field && isSimpleSqlField(field);
}

async function loadCollectionDocs(
  collectionName: string,
  options?: {
    filter?: UpdateFilter;
    sortField?: string | null;
    sortOrder?: 1 | -1;
    limit?: number;
    skip?: number;
  },
): Promise<AnyDoc[]> {
  await ensureCollectionTable(collectionName);

  const client = getSqlClient();
  const tableName = tableNameForCollection(collectionName);
  const quoted = quoteIdentifier(tableName);

  let sql = `SELECT _tid, doc FROM ${quoted}`;
  const args: InValue[] = [];

  const useSqlFilter = options?.filter && canUseSqlFilter(options.filter);
  if (useSqlFilter) {
    const clauses = Object.entries(options!.filter!).map(([key, value]) => {
      args.push(`$.${key}`, normalizeValue(value) as InValue);
      return `json_extract(doc, ?) = ?`;
    });
    sql += ` WHERE ${clauses.join(" AND ")}`;
  }

  if (canUseSqlSort(options?.sortField)) {
    args.push(`$.${options!.sortField!}`);
    sql += ` ORDER BY json_extract(doc, ?) ${options?.sortOrder === -1 ? "DESC" : "ASC"}`;
  }

  if (typeof options?.limit === "number" && options.limit >= 0) {
    sql += " LIMIT ?";
    args.push(options.limit);
  } else if (typeof options?.skip === "number" && options.skip > 0) {
    sql += " LIMIT -1";
  }

  if (typeof options?.skip === "number" && options.skip > 0) {
    sql += " OFFSET ?";
    args.push(options.skip);
  }

  const result = await client.execute({ sql, args });
  return result.rows
    .map((row) => {
      try {
        const doc = JSON.parse(String(row.doc || "{}")) as AnyDoc;
        doc._tid = String(row._tid || doc._tid || "");
        return cleanItem(doc);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as AnyDoc[];
}

async function saveCollectionDoc(collectionName: string, doc: AnyDoc): Promise<string> {
  await ensureCollectionTable(collectionName);

  const client = getSqlClient();
  const tableName = tableNameForCollection(collectionName);
  const quoted = quoteIdentifier(tableName);

  const nowIso = new Date().toISOString();
  const normalized = cleanItem(doc);
  const tid = extractTorsoId(normalized) || crypto.randomUUID();
  normalized._tid = tid;

  const createdAt = String(normalized.createdAt || nowIso);
  const updatedAt = String(normalized.updatedAt || nowIso);

  await client.execute({
    sql: `
      INSERT INTO ${quoted} (_tid, doc, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(_tid) DO UPDATE SET
        doc = excluded.doc,
        updated_at = excluded.updated_at
    `,
    args: [tid, JSON.stringify(normalized), createdAt, updatedAt],
  });

  return tid;
}

async function deleteCollectionDoc(collectionName: string, tid: string) {
  await ensureCollectionTable(collectionName);

  const client = getSqlClient();
  const tableName = tableNameForCollection(collectionName);
  const quoted = quoteIdentifier(tableName);

  await client.execute({
    sql: `DELETE FROM ${quoted} WHERE _tid = ?`,
    args: [tid],
  });
}

/**
 * Chainable query object that mirrors MongoDB driver's Cursor API.
 */
class TorsoQuery<T = any> {
  private sortField: string | null = null;
  private sortOrder: 1 | -1 = 1;
  private limitValue?: number;
  private skipValue?: number;

  constructor(
    private collectionName: string,
    private filter: UpdateFilter = {},
    private projection?: Projection,
  ) {}

  sort(sortSpec: Record<string, 1 | -1>): this {
    const entries = Object.entries(sortSpec);
    if (entries.length > 0) {
      const [field, order] = entries[0];
      this.sortField = field;
      this.sortOrder = order === -1 ? -1 : 1;
    }
    return this;
  }

  limit(n: number): this {
    this.limitValue = n;
    return this;
  }

  skip(n: number): this {
    this.skipValue = n;
    return this;
  }

  async toArray(): Promise<T[]> {
    try {
      let docs = await loadCollectionDocs(this.collectionName, {
        filter: this.filter,
        sortField: this.sortField,
        sortOrder: this.sortOrder,
        limit: this.limitValue,
        skip: this.skipValue,
      });

      docs = docs.filter((doc) => matchFilter(doc, this.filter));

      if (!canUseSqlSort(this.sortField) && this.sortField) {
        const field = this.sortField;
        const order = this.sortOrder;
        docs.sort((a, b) => {
          const av = getDirectValueAtPath(a, field);
          const bv = getDirectValueAtPath(b, field);
          if (av == null && bv == null) return 0;
          if (av == null) return order === 1 ? -1 : 1;
          if (bv == null) return order === 1 ? 1 : -1;
          if (av < bv) return order === 1 ? -1 : 1;
          if (av > bv) return order === 1 ? 1 : -1;
          return 0;
        });
      }

      if (!(typeof this.limitValue === "number" && this.limitValue >= 0) && this.skipValue && this.skipValue > 0) {
        docs = docs.slice(this.skipValue);
      }
      if (!(typeof this.skipValue === "number" && this.skipValue > 0) && typeof this.limitValue === "number" && this.limitValue >= 0) {
        docs = docs.slice(0, this.limitValue);
      }
      if (
        !(canUseSqlSort(this.sortField) || canUseSqlFilter(this.filter)) &&
        typeof this.skipValue === "number" &&
        this.skipValue > 0
      ) {
        docs = docs.slice(this.skipValue);
      }
      if (
        !(canUseSqlSort(this.sortField) || canUseSqlFilter(this.filter)) &&
        typeof this.limitValue === "number" &&
        this.limitValue >= 0
      ) {
        docs = docs.slice(0, this.limitValue);
      }

      return docs.map((doc) => applyProjection(doc, this.projection, this.filter) as T);
    } catch (err) {
      console.error(`[torso] find ${this.collectionName}.toArray error:`, err);
      return [];
    }
  }
}

class TorsoCollection {
  constructor(private name: string) {}

  async findOne<T = any>(filter: UpdateFilter, options?: FindOptions): Promise<T | null> {
    const query = this.find<T>(filter, options);
    const limit = options?.limit ?? 1;
    const items = await query.limit(limit).skip(options?.skip ?? 0).toArray();
    return items[0] ?? null;
  }

  find<T = any>(filter: UpdateFilter = {}, options?: FindOptions): TorsoQuery<T> {
    const query = new TorsoQuery<T>(this.name, filter, options?.projection);
    if (typeof options?.limit === "number") query.limit(options.limit);
    if (typeof options?.skip === "number") query.skip(options.skip);
    return query;
  }

  async updateOne(
    filter: UpdateFilter,
    update: Record<string, unknown>,
    options?: UpdateOptions,
  ): Promise<{ matchedCount: number; modifiedCount: number; upsertedCount?: number }> {
    try {
      const existing = await loadCollectionDocs(this.name, { filter });
      const doc = existing.find((item) => matchFilter(item, filter));
      const now = new Date().toISOString();

      if (!doc) {
        if (!options?.upsert) {
          return { matchedCount: 0, modifiedCount: 0 };
        }

        const newDoc: AnyDoc = {};
        for (const [key, value] of Object.entries(filter)) {
          if (!key.includes(".") && !isOperatorObject(value) && !Array.isArray(value) && !isPlainObject(value)) {
            newDoc[key] = normalizeValue(value);
          }
        }

        const sets = (update.$set as Record<string, unknown> | undefined) ?? {};
        const setOnInsert = (update.$setOnInsert as Record<string, unknown> | undefined) ?? {};

        for (const [key, value] of Object.entries(setOnInsert)) {
          if (key.includes(".")) {
            setDirectValueAtPath(newDoc, key, normalizeValue(value));
          } else {
            newDoc[key] = normalizeValue(value);
          }
        }

        for (const [key, value] of Object.entries(sets)) {
          if (key.includes(".")) {
            setDirectValueAtPath(newDoc, key, normalizeValue(value));
          } else {
            newDoc[key] = normalizeValue(value);
          }
        }

        if (!newDoc.createdAt) newDoc.createdAt = now;
        newDoc.updatedAt = now;

        await saveCollectionDoc(this.name, newDoc);
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
      }

      const nextDoc = cloneValue(doc);
      const context = buildMutationContext(nextDoc, filter, options);
      let changed = false;

      const sets = update.$set as Record<string, unknown> | undefined;
      if (sets) {
        for (const [path, value] of Object.entries(sets)) {
          changed = applySetLikeMutation(nextDoc, path.split("."), value, context, "set") || changed;
        }
      }

      const pushes = update.$push as Record<string, unknown> | undefined;
      if (pushes) {
        for (const [path, value] of Object.entries(pushes)) {
          changed = applySetLikeMutation(nextDoc, path.split("."), value, context, "push") || changed;
        }
      }

      const pulls = update.$pull as Record<string, unknown> | undefined;
      if (pulls) {
        for (const [path, value] of Object.entries(pulls)) {
          changed = applySetLikeMutation(nextDoc, path.split("."), value, context, "pull") || changed;
        }
      }

      if (changed) {
        nextDoc.updatedAt = now;
        await saveCollectionDoc(this.name, nextDoc);
      }

      return { matchedCount: 1, modifiedCount: changed ? 1 : 0 };
    } catch (err) {
      console.error(`[torso] updateOne ${this.name} error:`, err);
      return { matchedCount: 0, modifiedCount: 0 };
    }
  }

  async insertOne<T = Record<string, unknown>>(doc: T): Promise<{ insertedId?: string }> {
    try {
      const nextDoc = cleanItem(doc as AnyDoc);
      const now = new Date().toISOString();
      if (!nextDoc.createdAt) nextDoc.createdAt = now;
      nextDoc.updatedAt = now;

      const insertedId = await saveCollectionDoc(this.name, nextDoc);
      return { insertedId };
    } catch (err) {
      console.error(`[torso] insertOne ${this.name} error:`, err);
      return {};
    }
  }

  async deleteOne(filter: UpdateFilter): Promise<{ deletedCount: number }> {
    try {
      const docs = await loadCollectionDocs(this.name, { filter });
      const doc = docs.find((item) => matchFilter(item, filter));
      const tid = doc ? extractTorsoId(doc) : undefined;
      if (!tid) return { deletedCount: 0 };

      await deleteCollectionDoc(this.name, tid);
      return { deletedCount: 1 };
    } catch (err) {
      console.error(`[torso] deleteOne ${this.name} error:`, err);
      return { deletedCount: 0 };
    }
  }

  async deleteMany(filter: UpdateFilter): Promise<{ deletedCount: number }> {
    try {
      const docs = await loadCollectionDocs(this.name, { filter });
      const matched = docs.filter((item) => matchFilter(item, filter));

      for (const doc of matched) {
        const tid = extractTorsoId(doc);
        if (tid) {
          await deleteCollectionDoc(this.name, tid);
        }
      }

      return { deletedCount: matched.length };
    } catch (err) {
      console.error(`[torso] deleteMany ${this.name} error:`, err);
      return { deletedCount: 0 };
    }
  }
}

class TorsoDatabase {
  collection<T = any>(name: string): TorsoCollection {
    return new TorsoCollection(name);
  }

  db(_name?: string): TorsoDatabase {
    return this;
  }
}

let torsoPromise: Promise<{ db: (name?: string) => TorsoDatabase }>;

function createTorsoClient(): Promise<{ db: (name?: string) => TorsoDatabase }> {
  console.log(`[torso] Initializing with URL: ${TORSO_URL || "(missing)"}`);

  if (!TORSO_URL || !TORSO_TOKEN) {
    console.warn("[torso] Warning: TORSO_URL or TORSO_TOKEN is not set. Auth will fail until configured.");
    return Promise.resolve({ db: (_name?: string) => new TorsoDatabase().db(_name) });
  }

  try {
    const client = getSqlClient();
    return client
      .execute("SELECT 1 AS ok")
      .then(() => {
        console.log("[torso] Connected to Turso successfully.");
        return { db: (_name?: string) => new TorsoDatabase().db(_name) };
      })
      .catch((err) => {
        console.error(`[torso] Connection test failed: ${err?.message}`);
        console.warn("[torso] Will continue without a healthy connection check.");
        return { db: (_name?: string) => new TorsoDatabase().db(_name) };
      });
  } catch (err: any) {
    console.error(`[torso] Failed to initialize client: ${err?.message}`);
    return Promise.resolve({ db: (_name?: string) => new TorsoDatabase().db(_name) });
  }
}

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
