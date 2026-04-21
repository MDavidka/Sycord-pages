import fs from 'fs';
import path from 'path';
import clientPromise from './mongodb';

export async function logAiDebug(action: string, details: any) {
  const timestamp = new Date().toISOString();
  const logData = { timestamp, action, details };

  // 1. Write to file
  try {
    const logDir = path.join(process.cwd(), 'main', 'log');
    const logFile = path.join(logDir, 'log.txt');

    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logString = \`[\${timestamp}] [\${action}] \${JSON.stringify(details)}\n\`;
    fs.appendFileSync(logFile, logString, 'utf8');
  } catch (fsError) {
    console.error('Failed to log to file (possibly read-only filesystem):', fsError);
  }

  // 2. Write to database
  try {
    const client = await clientPromise;
    const db = client.db();
    await db.collection('ai_debug_logs').insertOne(logData);
  } catch (dbError) {
    console.error('Failed to log to database:', dbError);
  }
}
