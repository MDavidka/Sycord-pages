import fs from 'fs/promises';
import path from 'path';

export const readLogFile = async (logPath: string, limit: number = 300): Promise<string[]> => {
  try {
    const content = await fs.readFile(logPath, 'utf8');
    const lines = content.split('\n');
    return lines.slice(-limit);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    console.error(`Error reading log file ${logPath}:`, error);
    return [`Error reading log file: ${error.message}`];
  }
};

export const appendLogFile = async (logPath: string, message: string) => {
  try {
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    await fs.appendFile(logPath, `${new Date().toISOString()} - ${message}\n`);
  } catch (error) {
    console.error(`Error writing to log file ${logPath}:`, error);
  }
};
