import { Db } from 'mongodb';
import {
  ProjectMemoryDocument,
  BuildPlanDocument,
  BuildHistoryDocument,
  ProjectConfigDocument,
  DiagnosticsDocument,
  getCollectionIndexes,
  validateProjectConfigDocument,
} from './db-schemas';
import { AIMemory } from './ai-memory-manager';
import { BuildPlan } from './planner';
import { BuildRecord } from './build-history';

export class SyraDatabase {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Initialize collections and indexes
   */
  async initialize(): Promise<void> {
    const indexes = getCollectionIndexes();

    // Create indexes
    for (const [collectionName, indexList] of Object.entries(indexes)) {
      const collection = this.db.collection(collectionName);
      for (const index of indexList) {
        await collection.createIndex(index.key, { unique: index.unique });
      }
    }
  }

  /**
   * Save or update AI memory for a project
   */
  async saveProjectMemory(projectId: string, projectName: string, memory: AIMemory): Promise<void> {
    const collection = this.db.collection<ProjectMemoryDocument>('projectMemory');

    await collection.updateOne(
      { projectId },
      {
        $set: {
          projectId,
          projectName,
          memory,
          updatedAt: new Date(),
          lastAccessed: new Date(),
        },
        $inc: { accessCount: 1 },
      },
      { upsert: true },
    );
  }

  /**
   * Get AI memory for a project
   */
  async getProjectMemory(projectId: string): Promise<AIMemory | null> {
    const collection = this.db.collection<ProjectMemoryDocument>('projectMemory');

    const doc = await collection.findOneAndUpdate(
      { projectId },
      { $set: { lastAccessed: new Date() }, $inc: { accessCount: 1 } },
      { returnDocument: 'after' },
    );

    return doc.value?.memory || null;
  }

  /**
   * Save a build plan
   */
  async saveBuildPlan(projectId: string, plan: BuildPlan, status: 'draft' | 'approved' | 'executed' = 'draft'): Promise<string> {
    const collection = this.db.collection<BuildPlanDocument>('buildPlans');

    const result = await collection.insertOne({
      projectId,
      plan,
      status,
      createdAt: new Date(),
    } as any);

    return result.insertedId.toString();
  }

  /**
   * Get build plans for a project
   */
  async getBuildPlans(projectId: string, limit: number = 10): Promise<BuildPlan[]> {
    const collection = this.db.collection<BuildPlanDocument>('buildPlans');

    const docs = await collection
      .find({ projectId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return docs.map(d => d.plan);
  }

  /**
   * Save a build record to history
   */
  async saveBuildRecord(projectId: string, record: BuildRecord, tags?: string[]): Promise<void> {
    const collection = this.db.collection<BuildHistoryDocument>('buildHistory');

    await collection.insertOne({
      projectId,
      record,
      createdAt: new Date(),
      indexedTokens: record.metadata.contextTokens,
      tags,
    } as any);
  }

  /**
   * Get build history for a project
   */
  async getBuildHistory(projectId: string, limit: number = 50): Promise<BuildRecord[]> {
    const collection = this.db.collection<BuildHistoryDocument>('buildHistory');

    const docs = await collection
      .find({ projectId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return docs.map(d => d.record);
  }

  /**
   * Get build statistics
   */
  async getBuildStats(projectId: string): Promise<{
    totalBuilds: number;
    successRate: number;
    averageDuration: number;
    totalRepairs: number;
  }> {
    const collection = this.db.collection<BuildHistoryDocument>('buildHistory');

    const stats = await collection
      .aggregate([
        { $match: { projectId } },
        {
          $group: {
            _id: null,
            totalBuilds: { $sum: 1 },
            successfulBuilds: {
              $sum: { $cond: [{ $eq: ['$record.status', 'success'] }, 1, 0] },
            },
            totalDuration: { $sum: '$record.duration' },
            totalRepairs: { $sum: '$record.metadata.repairPasses' },
          },
        },
      ])
      .toArray();

    if (stats.length === 0) {
      return {
        totalBuilds: 0,
        successRate: 0,
        averageDuration: 0,
        totalRepairs: 0,
      };
    }

    const data = stats[0];
    return {
      totalBuilds: data.totalBuilds,
      successRate: data.totalBuilds > 0 ? data.successfulBuilds / data.totalBuilds : 0,
      averageDuration: data.totalBuilds > 0 ? data.totalDuration / data.totalBuilds : 0,
      totalRepairs: data.totalRepairs,
    };
  }

  /**
   * Save or update project configuration
   */
  async saveProjectConfig(projectId: string, config: Partial<ProjectConfigDocument>): Promise<void> {
    const collection = this.db.collection<ProjectConfigDocument>('projectConfig');

    await collection.updateOne(
      { projectId },
      {
        $set: {
          ...config,
          projectId,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
  }

  /**
   * Get project configuration
   */
  async getProjectConfig(projectId: string): Promise<ProjectConfigDocument | null> {
    const collection = this.db.collection<ProjectConfigDocument>('projectConfig');
    return collection.findOne({ projectId });
  }

  /**
   * Save validation diagnostics
   */
  async saveDiagnostics(
    projectId: string,
    buildId: string,
    code: string,
    diagnostics: any[],
    score: number,
  ): Promise<void> {
    const collection = this.db.collection<DiagnosticsDocument>('diagnostics');

    await collection.insertOne({
      projectId,
      buildId,
      code,
      diagnostics,
      score,
      timestamp: new Date(),
    } as any);
  }

  /**
   * Get recent failed builds for debugging
   */
  async getFailedBuilds(projectId: string, limit: number = 20): Promise<BuildRecord[]> {
    const collection = this.db.collection<BuildHistoryDocument>('buildHistory');

    const docs = await collection
      .find({ projectId, 'record.status': 'failed' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return docs.map(d => d.record);
  }

  /**
   * Clean up old records
   */
  async cleanupOldRecords(projectId: string, daysOld: number = 30): Promise<number> {
    const collection = this.db.collection<BuildHistoryDocument>('buildHistory');
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const result = await collection.deleteMany({
      projectId,
      createdAt: { $lt: cutoffDate },
    });

    return result.deletedCount || 0;
  }
}

/**
 * Get database instance
 */
export async function getSyraDatabase(mongoClient: any): Promise<SyraDatabase> {
  const db = mongoClient.db();
  const service = new SyraDatabase(db);
  await service.initialize();
  return service;
}
