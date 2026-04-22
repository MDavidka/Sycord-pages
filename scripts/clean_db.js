const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function cleanLogs() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error("MONGO_URI not found");
        return;
    }
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('main');
        const result = await db.collection('ai_debug_logs').deleteMany({});
        console.log(`Deleted ${result.deletedCount} documents from ai_debug_logs.`);
    } catch (e) {
        console.error("Error cleaning logs:", e);
    } finally {
        await client.close();
    }
}

cleanLogs();
