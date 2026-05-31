import { BuildPlan } from './planner';
import { ValidationResult } from './validator';
import { RepairResult } from './auto-repair';

export interface BuildRecord {
  id: string;
  timestamp: number;
  prompt: string;
  status: 'pending' | 'planning' | 'generating' | 'validating' | 'repairing' | 'success' | 'failed';
  plan?: BuildPlan;
  generatedCode?: string;
  validationResults?: ValidationResult[];
  repairResults?: RepairResult[];
  finalCode?: string;
  duration: number; // milliseconds
  metadata: {
    intent?: string;
    contextFiles?: number;
    contextTokens?: number;
    repairPasses?: number;
    cacheHit?: boolean;
  };
  error?: {
    message: string;
    code: string;
    recoverable: boolean;
  };
}

export interface BuildHistory {
  records: BuildRecord[];
  totalBuilds: number;
  successRate: number;
  averageDuration: number;
  totalRepairPasses: number;
  cacheHitRate: number;
}

/**
 * Create a new build record
 */
export function createBuildRecord(prompt: string): BuildRecord {
  return {
    id: `build_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    prompt,
    status: 'pending',
    duration: 0,
    metadata: {
      contextFiles: 0,
      contextTokens: 0,
      repairPasses: 0,
      cacheHit: false,
    },
  };
}

/**
 * Update build record status
 */
export function updateBuildStatus(
  record: BuildRecord,
  status: BuildRecord['status'],
  additionalData?: Partial<BuildRecord>,
): BuildRecord {
  return {
    ...record,
    status,
    ...additionalData,
  };
}

/**
 * Complete build record
 */
export function completeBuildRecord(
  record: BuildRecord,
  status: 'success' | 'failed',
  finalCode?: string,
  error?: BuildRecord['error'],
): BuildRecord {
  const duration = Date.now() - record.timestamp;

  return {
    ...record,
    status,
    finalCode,
    duration,
    error,
    metadata: {
      ...record.metadata,
      repairPasses: record.repairResults?.length || 0,
    },
  };
}

/**
 * Calculate build history statistics
 */
export function calculateHistoryStats(records: BuildRecord[]): BuildHistory {
  const successCount = records.filter(r => r.status === 'success').length;
  const totalDuration = records.reduce((sum, r) => sum + r.duration, 0);
  const totalRepairs = records.reduce((sum, r) => sum + (r.metadata.repairPasses || 0), 0);
  const cacheHits = records.filter(r => r.metadata.cacheHit).length;

  return {
    records,
    totalBuilds: records.length,
    successRate: records.length > 0 ? successCount / records.length : 0,
    averageDuration: records.length > 0 ? totalDuration / records.length : 0,
    totalRepairPasses: totalRepairs,
    cacheHitRate: records.length > 0 ? cacheHits / records.length : 0,
  };
}

/**
 * Get recent builds
 */
export function getRecentBuilds(records: BuildRecord[], limit: number = 10): BuildRecord[] {
  return records.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

/**
 * Find builds by status
 */
export function findBuildsByStatus(records: BuildRecord[], status: BuildRecord['status']): BuildRecord[] {
  return records.filter(r => r.status === status);
}

/**
 * Generate build history summary
 */
export function generateHistorySummary(history: BuildHistory): string {
  const successPercent = (history.successRate * 100).toFixed(1);
  const avgDurationMs = history.averageDuration.toFixed(0);
  const cachePercent = (history.cacheHitRate * 100).toFixed(1);

  return `Build History Summary
━━━━━━━━━━━━━━━━━━━━━━━━
Total Builds: ${history.totalBuilds}
Success Rate: ${successPercent}%
Avg Duration: ${avgDurationMs}ms
Total Repair Passes: ${history.totalRepairPasses}
Cache Hit Rate: ${cachePercent}%`;
}

/**
 * Export build history as JSON
 */
export function exportBuildHistory(history: BuildHistory): string {
  return JSON.stringify(history, null, 2);
}

/**
 * Get failed builds for debugging
 */
export function getFailedBuilds(records: BuildRecord[]): Array<BuildRecord & { error: NonNullable<BuildRecord['error']> }> {
  return records
    .filter((r): r is BuildRecord & { error: NonNullable<BuildRecord['error']> } => r.status === 'failed' && r.error !== undefined);
}

/**
 * Analyze slow builds
 */
export function analyzeSlowBuilds(records: BuildRecord[], thresholdMs: number = 5000): BuildRecord[] {
  return records
    .filter(r => r.duration > thresholdMs)
    .sort((a, b) => b.duration - a.duration);
}
