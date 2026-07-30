import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI;
const defaultDbName = process.env.MONGO_DB_NAME || "main";
let client: MongoClient;
let clientPromise: Promise<MongoClient>;
let indexesEnsured: Promise<void> | null = null;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function missingMongoPromise(): Promise<MongoClient> {
  const error = new Error("Missing MONGO_URI environment variable");
  console.warn(error.message);
  return {
    then: (onfulfilled, onrejected) => Promise.reject(error).then(onfulfilled, onrejected),
    catch: (onrejected) => Promise.reject(error).catch(onrejected),
    finally: (onfinally) => Promise.reject(error).finally(onfinally),
    [Symbol.toStringTag]: "Promise",
  } as Promise<MongoClient>;
}

/**
 * Make sure the indexes the dashboard relies on exist. This is idempotent and
 * runs once per process. Without `users.id` indexed, the dashboard load is a
 * collection scan.
 */
async function ensureIndexes(connected: MongoClient): Promise<void> {
  try {
    const db = connected.db();
    await db.collection("users").createIndex({ id: 1 }, { unique: true, name: "users_id_unique" });
    // Speeds up the dashboard's product and page fetches per project.
    await db.collection("products").createIndex({ projectId: 1 }, { name: "products_projectId_idx" });
    await db.collection("pages").createIndex({ projectId: 1 }, { name: "pages_projectId_idx" });
  } catch (err) {
    // Index creation should never break the app; log and continue.
    console.warn("[mongodb] Failed to ensure indexes:", (err as Error)?.message);
  }
}

if (!uri) {
  clientPromise = missingMongoPromise();
} else if (process.env.NODE_ENV === "development") {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, {});
    global._mongoClientPromise = client.connect().then((connected) => {
      const originalDb = connected.db.bind(connected);
      connected.db = (dbName?: string, options?: any) =>
        originalDb(dbName || defaultDbName, options);
      if (!indexesEnsured) {
        indexesEnsured = ensureIndexes(connected).catch(() => undefined);
      }
      return connected;
    });
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, {});
  clientPromise = client.connect().then((connected) => {
    const originalDb = connected.db.bind(connected);
    connected.db = (dbName?: string, options?: any) =>
      originalDb(dbName || defaultDbName, options);
    if (!indexesEnsured) {
      indexesEnsured = ensureIndexes(connected).catch(() => undefined);
    }
    return connected;
  });
}

export default clientPromise;
