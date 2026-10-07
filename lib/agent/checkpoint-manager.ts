/**
 * Durable Checkpoint Manager
 * Serializes and restores agent execution state to disk (`state.json`),
 * supporting atomic subtask checkpoints, deterministic resumption, and file rollbacks.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SessionCheckpoint } from './types.ts';

export interface CheckpointManagerOptions {
  storageFile?: string;
  backupDir?: string;
}

export class CheckpointManager {
  private readonly storageFile: string;
  private readonly backupDir: string;

  constructor(options?: CheckpointManagerOptions) {
    this.storageFile = options?.storageFile || path.resolve(process.cwd(), 'state.json');
    this.backupDir = options?.backupDir || path.resolve(process.cwd(), '.agent_checkpoints');
  }

  public getStorageFilePath(): string {
    return this.storageFile;
  }

  /**
   * Save checkpoint atomically to disk.
   */
  public async saveCheckpoint(checkpoint: SessionCheckpoint): Promise<void> {
    try {
      const serialized = JSON.stringify(checkpoint, null, 2);

      const storageDir = path.dirname(this.storageFile);
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }

      // 1. Write atomic temp file then rename
      const tempPath = `${this.storageFile}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, serialized, 'utf-8');
      fs.renameSync(tempPath, this.storageFile);

      // 2. Also keep historical copy in backup directory for step rollbacks
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }
      const historyPath = path.join(
        this.backupDir,
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
      if (!fs.existsSync(this.storageFile)) {
        return null;
      }
      const content = fs.readFileSync(this.storageFile, 'utf-8');
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
    // Resumable if running, interrupted, or timeout with uncompleted subtasks
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

    for (const [filePath, diff] of Object.entries(checkpoint.artifacts_modified || {})) {
      try {
        const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
        if (diff.before === null) {
          // File was created in this session, delete it on rollback
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            rolledBack.push(filePath);
          }
        } else {
          // Revert to original content
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

    return { rolledBack, errors };
  }

  /**
   * Remove current checkpoint file after successful completion.
   */
  public async clearCheckpoint(): Promise<void> {
    try {
      if (fs.existsSync(this.storageFile)) {
        fs.unlinkSync(this.storageFile);
      }
    } catch (err) {
      console.warn(`[CheckpointManager] Failed to remove ${this.storageFile}:`, err);
    }
  }
}
