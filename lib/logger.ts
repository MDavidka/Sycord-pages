import fs from 'fs';
import path from 'path';
import clientPromise from './mongodb';

// Vercel's Lambda filesystem is read-only except for /tmp, so attempting to
// write `main/log/log.txt` under `process.cwd()` fails on every AI call with
// `ENOENT ... mkdir '/var/task/main/log'`. We skip file logging entirely in
// serverless runtimes, and also cache the "filesystem is read-only" decision
// after the first failure so we don't spam the console.
const IS_SERVERLESS_READONLY_FS =
  !!process.env.VERCEL ||
  !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
  !!process.env.LAMBDA_TASK_ROOT;

let fileLoggingDisabled = IS_SERVERLESS_READONLY_FS;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function logAiDebug(action: string, details: any) {
  const timestamp = new Date().toISOString();
  const logData = { timestamp, action, details };

  // 1. Write to file (skipped on Vercel / Lambda).
  if (!fileLoggingDisabled) {
    try {
      const logDir = path.join(process.cwd(), 'main', 'log');
      const logFile = path.join(logDir, 'log.txt');

      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const logString = `[${timestamp}] [${action}] ${JSON.stringify(details)}\n`;
      fs.appendFileSync(logFile, logString, 'utf8');
    } catch (fsError) {
      // First failure means the FS is effectively read-only (Vercel / Lambda
      // where VERCEL env wasn't set, read-only bind mount, etc.). Disable
      // future attempts so we don't keep logging the same error.
      fileLoggingDisabled = true;
      console.warn('[logger] file logging disabled:', (fsError as Error).message);
    }
  }

  // 2. Write to database (still works on serverless).
  try {
    const client = await clientPromise;
    const db = client.db();
    await db.collection('ai_debug_logs').insertOne(logData);
  } catch (dbError) {
    console.error('Failed to log to database:', dbError);
  }
}
