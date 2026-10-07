/**
 * Durable Checkpoint Manager
 * Serializes and restores agent execution state to disk (`state.json`),
 * supporting atomic subtask checkpoints, deterministic resumption, and file rollbacks.
 * Uses dynamic import('node:fs') and import('node:path') for universal safety.
 */

import type { SessionCheckpoint } from './types.ts';

export interface CheckpointManagerOptions {
  storageFile?: string;
  backupDir?: string;
}

export class CheckpointManager {
  private storageFile: string;
  private backupDir: string;

  constructor(options?: CheckpointManagerOptions) {
    this.storageFile = options?.storageFile || 'state.json';
    this.backupDir = options?.backupDir || '.agent_checkpoints';
  }

  private async getFsAndPath() {
    const fs = await import('node:fs');
    const path = await import('node:path');
    return { fs, path };
  }

  public getStorageFilePath(): string {
    return this.storageFile;
  }

  /**
   * Save checkpoint atomically to disk.
   */
  public async saveCheckpoint(checkpoint: SessionCheckpoint): Promise<void> {
    try {
      const { fs, path } = await this.getFsAndPath();
      const cwd = typeof process !== 'undefined' && process.cwd ? process.cwd() : '.';
      const storageFile = path.isAbsolute(this.storageFile) ? this.storageFile : path.resolve(cwd, this.storageFile);
      const backupDir = path.isAbsolute(this.backupDir) ? this.backupDir : path.resolve(cwd, this.backupDir);

      const serialized = JSON.stringify(checkpoint, null, 2);

      const storageDir = path.dirname(storageFile);
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }

      // 1. Write atomic temp file then rename
      const tempPath = `${storageFile}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, serialized, 'utf-8');
      fs.renameSync(tempPath, storageFile);

      // 2. Also keep historical copy in backup directory for step rollbacks
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const historyPath = path.join(
        backupDir,
        `checkpoint_${checkpoint.task_id}_step_${checkpoint.current_step_index}_${Date.now()}.json`
      );
      fs.writeFileSync(historyPath, serialized, 'utf-8');
    } catch (err) {
      console.error(`[CheckpointManager] Failed to save checkpoint:`, err);
      throw err;
    }
  }

  /**
   * Load the latest active checkpoint from disk.
   */
  public async loadLatestCheckpoint(expectedTaskId?: string): Promise<SessionCheckpoint | null> {
    try {
      const { fs, path } = await this.getFsAndPath();
      const cwd = typeof process !== 'undefined' && process.cwd ? process.cwd() : '.';
      const storageFile = path.isAbsolute(this.storageFile) ? this.storageFile : path.resolve(cwd, this.storageFile);

      if (!fs.existsSync(storageFile)) {
        return null;
      }
      const content = fs.readFileSync(storageFile, 'utf-8');
      if (!content || !content.trim()) return null;

      const parsed = JSON.parse(content) as SessionCheckpoint;
      if (expectedTaskId && parsed.task_id !== expectedTaskId) {
        return null;
      }
      return parsed;
    } catch (err) {
      console.warn(`[CheckpointManager] Failed to parse ${this.storageFile}:`, err);
      return null;
    }
  }

  /**
   * Check if a task is eligible for deterministic resumption.
   */
  public async canResume(taskId?: string): Promise<boolean> {
    const cp = await this.loadLatestCheckpoint(taskId);
    if (!cp) return false;
    const hasPendingWork = cp.subtasks.some(s => s.status === 'pending' || s.status === 'in_progress');
    const isInterruptedStatus = cp.status === 'running' || cp.status === 'interrupted' || cp.status === 'timeout';
    return isInterruptedStatus || hasPendingWork;
  }

  /**
   * Rollback modified files to their `before` states for a given checkpoint or failed subtask.
   */
  public async rollbackArtifacts(checkpoint: SessionCheckpoint): Promise<{ rolledBack: string[]; errors: string[] }> {
    const rolledBack: string[] = [];
    const errors: string[] = [];

    try {
      const { fs, path } = await this.getFsAndPath();
      const cwd = typeof process !== 'undefined' && process.cwd ? process.cwd() : '.';

      for (const [filePath, diff] of Object.entries(checkpoint.artifacts_modified || {})) {
        try {
          const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
          if (diff.before === null) {
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath);
              rolledBack.push(filePath);
            }
          } else {
            const fileDir = path.dirname(fullPath);
            if (!fs.existsSync(fileDir)) {
              fs.mkdirSync(fileDir, { recursive: true });
            }
            fs.writeFileSync(fullPath, diff.before, 'utf-8');
            rolledBack.push(filePath);
          }
        } catch (err: any) {
          errors.push(`${filePath}: ${err?.message || err}`);
        }
      }
    } catch (err: any) {
      errors.push(`Failed to initialize filesystem module: ${err?.message || err}`);
    }

    return { rolledBack, errors };
  }

  /**
   * Remove current checkpoint file after successful completion.
   */
  public async clearCheckpoint(): Promise<void> {
    try {
      const { fs, path } = await this.getFsAndPath();
      const cwd = typeof process !== 'undefined' && process.cwd ? process.cwd() : '.';
      const storageFile = path.isAbsolute(this.storageFile) ? this.storageFile : path.resolve(cwd, this.storageFile);

      if (fs.existsSync(storageFile)) {
        fs.unlinkSync(storageFile);
      }
    } catch (err) {
      console.warn(`[CheckpointManager] Failed to remove ${this.storageFile}:`, err);
    }
  }
}
