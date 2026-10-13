import { ProjectMemory, CacheStats } from "./types";

const memoryCache = new Map<string, { memory: ProjectMemory; expires: number }>();
const summaryCache = new Map<string, { summary: any; expires: number }>();
const planCache = new Map<string, { plan: any; expires: number }>();

const MEMORY_TTL = 15 * 60 * 1000;
const SUMMARY_TTL = 60 * 60 * 1000;
const PLAN_TTL = 5 * 60 * 1000;

export function getCachedMemory(userId: string, projectId: string, revision: string, stats: CacheStats): ProjectMemory | null {
  const key = `project-memory:${userId}:${projectId}:${revision}`;
  const hit = memoryCache.get(key);
  if (hit && hit.expires > Date.now()) {
    stats.memoryHit = true;
    return hit.memory;
  }
  return null;
}

export function setCachedMemory(userId: string, projectId: string, revision: string, memory: ProjectMemory) {
  const key = `project-memory:${userId}:${projectId}:${revision}`;
  memoryCache.set(key, { memory, expires: Date.now() + MEMORY_TTL });
}

export function getCachedSummary(contentHash: string, stats: CacheStats): any | null {
  const key = `file-summary:${contentHash}`;
  const hit = summaryCache.get(key);
  if (hit && hit.expires > Date.now()) {
    stats.fileSummaryHits++;
    return hit.summary;
  }
  stats.fileSummaryMisses++;
  return null;
}

export function setCachedSummary(contentHash: string, summary: any) {
  const key = `file-summary:${contentHash}`;
  summaryCache.set(key, { summary, expires: Date.now() + SUMMARY_TTL });
}

export function getCachedPlan(mode: string, promptHash: string, revision: string, modelId: string, stats: CacheStats): any | null {
  const key = `plan:${mode}:${promptHash}:${revision}:${modelId}`;
  const hit = planCache.get(key);
  if (hit && hit.expires > Date.now()) {
    stats.planHit = true;
    return hit.plan;
  }
  return null;
}

export function setCachedPlan(mode: string, promptHash: string, revision: string, modelId: string, plan: any) {
  const key = `plan:${mode}:${promptHash}:${revision}:${modelId}`;
  planCache.set(key, { plan, expires: Date.now() + PLAN_TTL });
}
