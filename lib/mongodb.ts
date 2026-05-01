import { MongoClient } from "mongodb";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const defaultDbName = process.env.MONGO_DB_NAME || "main";

function connectMongo(): Promise<MongoClient> {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    return Promise.reject(new Error("Missing MONGO_URI environment variable"));
  }

  const client = new MongoClient(uri, {});
  return client.connect().then((connected) => {
    const originalDb = connected.db.bind(connected);
    connected.db = (dbName?: string, options?: any) =>
      originalDb(dbName || defaultDbName, options);
    return connected;
  });
}

function getClientPromise(): Promise<MongoClient> {
  if (process.env.NODE_ENV === "development") {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    if (!globalThis._mongoClientPromise) {
      globalThis._mongoClientPromise = connectMongo();
    }
    return globalThis._mongoClientPromise;
  }
  return connectMongo();
}

let productionClientPromise: Promise<MongoClient> | undefined;

const clientPromise = {
  then<TResult1 = MongoClient, TResult2 = never>(
    onfulfilled?: ((value: MongoClient) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    if (process.env.NODE_ENV === "development") {
      return getClientPromise().then(onfulfilled, onrejected);
    }
    productionClientPromise ??= getClientPromise();
    return productionClientPromise.then(onfulfilled, onrejected);
  },
  catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null) {
    return this.then(null, onrejected);
  },
  finally(onfinally?: (() => void) | null) {
    if (process.env.NODE_ENV === "development") {
      return getClientPromise().finally(onfinally);
    }
    productionClientPromise ??= getClientPromise();
    return productionClientPromise.finally(onfinally);
  },
  [Symbol.toStringTag]: "Promise",
} as Promise<MongoClient>;

export default clientPromise;
