import { ObjectId } from 'mongodb';
import { AIMemory } from './ai-memory-manager';
import { BuildPlan } from './planner';
import { BuildRecord } from './build-history';

/**
 * MongoDB collection schemas for Syra pipeline
 */

/**
 * Stores AI memory cache for projects
 */
export interface ProjectMemoryDocument {
  _id: ObjectId;
  projectId: string;
  projectName: string;
  memory: AIMemory;
  createdAt: Date;
  updatedAt: Date;
  accessCount: number;
  lastAccessed: Date;
}

/**
 * Stores build plans for audit trail and reuse
 */
export interface BuildPlanDocument {
  _id: ObjectId;
  projectId: string;
  plan: BuildPlan;
  status: 'draft' | 'approved' | 'executed' | 'archived';
  createdAt: Date;
  executedAt?: Date;
  generatedCode?: string;
  feedback?: string;
}

/**
 * Stores build history and analytics
 */
export interface BuildHistoryDocument {
  _id: ObjectId;
  projectId: string;
  record: BuildRecord;
  createdAt: Date;
  indexedTokens?: number; // For search optimization
  tags?: string[]; // For filtering builds
}

/**
 * Stores project metadata and configuration
 */
export interface ProjectConfigDocument {
  _id: ObjectId;
  projectId: string;
  projectName: string;
  description?: string;
  framework: 'next.js' | 'react' | 'vue' | 'svelte' | 'other';
  database?: 'mongodb' | 'postgresql' | 'mysql' | 'none';
  aiSettings: {
    model: string;
    temperature: number;
    maxTokens: number;
    enableAutoRepair: boolean;
    maxRepairPasses: number;
  };
  buildSettings: {
    autoCreatePlan: boolean;
    autoValidate: boolean;
    autoRepair: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
  owner: string; // userId
}

/**
 * Stores validation diagnostics for archive and analysis
 */
export interface DiagnosticsDocument {
  _id: ObjectId;
  projectId: string;
  buildId: string;
  code: string;
  diagnostics: Array<{
    severity: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    suggestedFix?: string;
  }>;
  score: number;
  timestamp: Date;
}

/**
 * Create indexes for collections
 */
export function getCollectionIndexes() {
  return {
    projectMemory: [
      { key: { projectId: 1 }, unique: true },
      { key: { updatedAt: -1 } },
      { key: { lastAccessed: -1 } },
    ],
    buildPlans: [
      { key: { projectId: 1, createdAt: -1 } },
      { key: { status: 1 } },
      { key: { 'plan.estimatedComplexity': 1 } },
    ],
    buildHistory: [
      { key: { projectId: 1, createdAt: -1 } },
      { key: { 'record.status': 1 } },
      { key: { 'record.metadata.repairPasses': 1 } },
    ],
    projectConfig: [
      { key: { projectId: 1 }, unique: true },
      { key: { owner: 1 } },
    ],
    diagnostics: [
      { key: { projectId: 1, buildId: 1 } },
      { key: { timestamp: -1 } },
      { key: { score: 1 } },
    ],
  };
}

/**
 * Validation functions for documents
 */
export function validateProjectMemoryDocument(doc: any): doc is ProjectMemoryDocument {
  return (
    doc._id instanceof ObjectId &&
    typeof doc.projectId === 'string' &&
    typeof doc.projectName === 'string' &&
    doc.memory && typeof doc.memory === 'object' &&
    doc.createdAt instanceof Date &&
    doc.updatedAt instanceof Date &&
    typeof doc.accessCount === 'number'
  );
}

export function validateProjectConfigDocument(doc: any): doc is ProjectConfigDocument {
  return (
    doc._id instanceof ObjectId &&
    typeof doc.projectId === 'string' &&
    ['next.js', 'react', 'vue', 'svelte', 'other'].includes(doc.framework) &&
    doc.aiSettings && typeof doc.aiSettings === 'object' &&
    doc.buildSettings && typeof doc.buildSettings === 'object'
  );
}

export function validateBuildHistoryDocument(doc: any): doc is BuildHistoryDocument {
  return (
    doc._id instanceof ObjectId &&
    typeof doc.projectId === 'string' &&
    doc.record && typeof doc.record === 'object' &&
    doc.createdAt instanceof Date
  );
}
