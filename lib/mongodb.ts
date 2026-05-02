import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI;
const defaultDbName = process.env.MONGO_DB_NAME || "main";
let client: MongoClient;
let clientPromise: Promise<MongoClient>;

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
    return connected;
  });
}

export default clientPromise;
