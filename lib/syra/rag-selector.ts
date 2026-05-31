import { AIMemory, FileMetadata } from './ai-memory-manager';
import { DetectedIntent } from './intent-detection';

export interface ContextRelevance {
  file: FileMetadata;
  score: number;
  reasons: string[];
}

export interface SelectedContext {
  files: FileMetadata[];
  averageRelevance: number;
  totalTokens: number;
  maxFiles: number;
}

const MAX_CONTEXT_FILES = 15;
const MAX_CONTEXT_TOKENS = 8000; // Approximate token limit for context

/**
 * Select relevant files from project memory using RAG scoring
 */
export function selectRelevantContext(
  memory: AIMemory,
  intent: DetectedIntent,
  prompt: string,
  maxFiles: number = MAX_CONTEXT_FILES,
): SelectedContext {
  const relevanceScores = memory.fileMetadata.map(file => {
    const score = calculateRelevanceScore(file, intent, prompt, memory);
    return { file, score };
  });

  // Sort by relevance score descending
  relevanceScores.sort((a, b) => b.score - a.score);

  // Select top files within token limit
  const selectedFiles: FileMetadata[] = [];
  let totalTokens = 0;

  for (const { file } of relevanceScores) {
    const fileTokens = Math.ceil(file.size / 4); // Rough estimate: 1 token per 4 chars
    if (totalTokens + fileTokens > MAX_CONTEXT_TOKENS) break;
    if (selectedFiles.length >= maxFiles) break;

    selectedFiles.push(file);
    totalTokens += fileTokens;
  }

  const averageRelevance = selectedFiles.length > 0
    ? selectedFiles.reduce((sum, file) => {
        const relevance = relevanceScores.find(r => r.file.path === file.path);
        return sum + (relevance?.score || 0);
      }, 0) / selectedFiles.length
    : 0;

  return {
    files: selectedFiles,
    averageRelevance,
    totalTokens,
    maxFiles,
  };
}

/**
 * Calculate relevance score for a single file
 */
function calculateRelevanceScore(
  file: FileMetadata,
  intent: DetectedIntent,
  prompt: string,
  memory: AIMemory,
): number {
  let score = 0;

  // File type relevance
  const typeScores: Record<string, number> = {
    component: 2,
    page: 3,
    api: 2,
    lib: 1,
    config: 0.5,
    other: 0.2,
  };
  score += typeScores[file.type] || 0;

  // Intent-based relevance
  if (intent.type.includes('page') && file.type === 'page') score += 3;
  if (intent.type.includes('component') && file.type === 'component') score += 3;
  if (intent.type.includes('api') && file.type === 'api') score += 3;

  // Prompt keyword matching
  const promptKeywords = prompt.toLowerCase().split(/\s+/);
  const fileNameWords = file.path.toLowerCase().split(/[\\/._-]/);

  for (const keyword of promptKeywords) {
    if (keyword.length > 3 && fileNameWords.some(word => word.includes(keyword))) {
      score += 1;
    }
  }

  // Import graph relevance (related files)
  const incomingImports = Object.entries(memory.importGraph).filter(([, imports]) =>
    imports.some(imp => imp.includes(file.path)),
  ).length;
  score += incomingImports * 0.5;

  // File size relevance (prefer smaller, focused files)
  if (file.size < 1000) score += 1;
  if (file.size > 5000) score -= 0.5;

  return score;
}

/**
 * Score context quality for plan generation
 */
export function scoreContextQuality(context: SelectedContext): number {
  if (context.files.length === 0) return 0;

  // Quality metrics
  const fileCountScore = Math.min(context.files.length / 5, 1);
  const relevanceScore = context.averageRelevance / 5;
  const diversityScore = calculateDiversity(context.files);

  // Weighted average
  return fileCountScore * 0.3 + relevanceScore * 0.4 + diversityScore * 0.3;
}

/**
 * Calculate diversity of selected files
 */
function calculateDiversity(files: FileMetadata[]): number {
  if (files.length === 0) return 0;

  const typeDistribution = new Map<string, number>();
  for (const file of files) {
    typeDistribution.set(file.type, (typeDistribution.get(file.type) || 0) + 1);
  }

  // Calculate entropy (higher = more diverse)
  let entropy = 0;
  for (const count of typeDistribution.values()) {
    const p = count / files.length;
    entropy -= p * Math.log2(p);
  }

  // Normalize entropy (max is log2(5) for 5 file types)
  return entropy / Math.log2(5);
}
