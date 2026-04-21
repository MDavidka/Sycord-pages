const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function checkLogs() {
    const uri = process.env.MONGO_URI || "mongodb://dummy";
    console.log("Using URI:", uri);
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('main');
        const logs = await db.collection('ai_debug_logs').find({}).sort({ timestamp: -1 }).limit(10).toArray();
        console.log("Recent logs:", JSON.stringify(logs, null, 2));
    } catch (e) {
        console.error("Error fetching logs:", e);
    } finally {
        await client.close();
    }
}

checkLogs();
