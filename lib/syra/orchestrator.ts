import { detectIntent, DetectedIntent, shouldCreatePlan } from './intent-detection';
import { computeProjectRevision, ProjectRevision, ProjectFile } from './project-revision';
import { createEmptyMemory, buildFileMetadata, buildImportGraph, AIMemory } from './ai-memory-manager';
import { selectRelevantContext, SelectedContext } from './rag-selector';
import { validateCode, ValidationResult } from './validator';
import { autoRepairCode, RepairResult } from './auto-repair';
import { BuildPlan, parsePlanResponse, validatePlan } from './planner';
import { createBuildRecord, updateBuildStatus, completeBuildRecord, BuildRecord } from './build-history';
import { SyraDatabase } from './db-service';

export interface BuildRequest {
  projectId: string;
  projectName: string;
  prompt: string;
  projectFiles: ProjectFile[];
  existingCode?: string;
}

export interface BuildResponse {
  success: boolean;
  buildRecord: BuildRecord;
  generatedCode?: string;
  plan?: BuildPlan;
  validationResult?: ValidationResult;
  repairResult?: RepairResult;
  diagnosticReport?: string;
  memoryStats?: {
    cacheHit: boolean;
    contextFiles: number;
    contextTokens: number;
  };
}

/**
 * Orchestrate the complete Syra pipeline
 */
export class SyraOrchestrator {
  private db: SyraDatabase;

  constructor(db: SyraDatabase) {
    this.db = db;
  }

  /**
   * Execute the full Syra build pipeline
   */
  async executeBuild(request: BuildRequest): Promise<BuildResponse> {
    console.log('[v0] Starting Syra pipeline for project:', request.projectId);

    // Create build record
    let buildRecord = createBuildRecord(request.prompt);

    try {
      // Step 1: Compute project revision
      console.log('[v0] Computing project revision...');
      const revision = computeProjectRevision(request.projectFiles);
      buildRecord = updateBuildStatus(buildRecord, 'planning', { metadata: { ...buildRecord.metadata } });

      // Step 2: Load or create AI memory
      console.log('[v0] Loading AI memory...');
      let memory = await this.db.getProjectMemory(request.projectId);
      let cacheHit = false;

      if (memory && memory.projectRevision.hash === revision.hash) {
        console.log('[v0] Cache hit! Using existing project memory');
        cacheHit = true;
      } else {
        console.log('[v0] Cache miss or revision changed, rebuilding memory...');
        memory = this.buildProjectMemory(revision, request.projectFiles);
        await this.db.saveProjectMemory(request.projectId, request.projectName, memory);
      }

      // Step 3: Detect intent
      console.log('[v0] Detecting user intent...');
      const intent = detectIntent(request.prompt);
      console.log('[v0] Detected intent:', intent.type, `(confidence: ${intent.confidence})`);

      // Step 4: RAG-based context selection
      console.log('[v0] Selecting relevant context...');
      const context = selectRelevantContext(memory, intent, request.prompt);
      console.log('[v0] Selected', context.files.length, 'files,', context.totalTokens, 'tokens');

      buildRecord = updateBuildStatus(buildRecord, 'planning', {
        metadata: {
          ...buildRecord.metadata,
          intent: intent.type,
          contextFiles: context.files.length,
          contextTokens: context.totalTokens,
          cacheHit,
        },
      });

      // Step 5: Decide if planning is needed
      const needsPlan = shouldCreatePlan(intent, request.prompt.length);
      let plan: BuildPlan | undefined;

      if (needsPlan) {
        console.log('[v0] Creating structured plan...');
        plan = await this.generatePlan(request.prompt, intent, context);
        await this.db.saveBuildPlan(request.projectId, plan, 'draft');
      }

      // Step 6: Generate code
      console.log('[v0] Generating code...');
      buildRecord = updateBuildStatus(buildRecord, 'generating');
      const generatedCode = await this.generateCode(request.prompt, context, plan, request.existingCode);

      // Step 7: Validate generated code
      console.log('[v0] Validating generated code...');
      buildRecord = updateBuildStatus(buildRecord, 'validating');
      const validationResult = validateCode(generatedCode, 'generated.tsx', {
        imports: memory.fileMetadata.map(f => f.path),
        targetFramework: 'next.js',
      });

      // Step 8: Auto-repair if needed
      let repairResult: RepairResult | undefined;
      if (!validationResult.isValid && validationResult.canAutoRepair) {
        console.log('[v0] Running auto-repair...');
        buildRecord = updateBuildStatus(buildRecord, 'repairing');
        repairResult = autoRepairCode(generatedCode, validationResult);
      }

      // Step 9: Final validation
      const finalCode = repairResult?.finalCode || generatedCode;
      const finalValidation = validateCode(finalCode, 'generated.tsx', {
        imports: memory.fileMetadata.map(f => f.path),
      });

      // Step 10: Save build record and return
      buildRecord = completeBuildRecord(
        buildRecord,
        finalValidation.isValid ? 'success' : 'failed',
        finalCode,
        finalValidation.isValid
          ? undefined
          : {
              message: finalValidation.summary,
              code: 'VALIDATION_FAILED',
              recoverable: true,
            },
      );

      await this.db.saveBuildRecord(request.projectId, buildRecord, [intent.type, 'completed']);

      return {
        success: finalValidation.isValid,
        buildRecord,
        generatedCode: finalCode,
        plan,
        validationResult: finalValidation,
        repairResult,
        memoryStats: {
          cacheHit,
          contextFiles: context.files.length,
          contextTokens: context.totalTokens,
        },
      };
    } catch (error) {
      console.error('[v0] Build pipeline failed:', error);

      const errorRecord = completeBuildRecord(
        buildRecord,
        'failed',
        undefined,
        {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'PIPELINE_ERROR',
          recoverable: true,
        },
      );

      await this.db.saveBuildRecord(request.projectId, errorRecord, ['error']);

      return {
        success: false,
        buildRecord: errorRecord,
      };
    }
  }

  /**
   * Build project memory from files
   */
  private buildProjectMemory(revision: ProjectRevision, files: ProjectFile[]): AIMemory {
    const memory = createEmptyMemory(revision);

    // Build file metadata
    memory.fileMetadata = files.map(f => buildFileMetadata(f.path, f.content));

    // Build import graph
    memory.importGraph = buildImportGraph(memory.fileMetadata);

    // Build route map (simplified)
    for (const file of memory.fileMetadata) {
      if (file.path.includes('/app/') && file.path.includes('page.')) {
        const route = file.path
          .replace('/app', '')
          .replace(/page\.(tsx|ts)$/, '')
          .replace(/\/$/, '') || '/';
        memory.routeMap[route] = {
          file: file.path,
          type: 'page',
        };
      }
    }

    return memory;
  }

  /**
   * Generate a plan for the build
   */
  private async generatePlan(
    prompt: string,
    intent: DetectedIntent,
    context: SelectedContext,
  ): Promise<BuildPlan> {
    // In production, this would call the LLM with special plan-generation prompt
    // For now, return a simplified plan structure

    const planSteps = [
      {
        id: 'step_1',
        title: 'Analyze Requirements',
        description: `Analyzing: ${prompt.substring(0, 100)}...`,
        action: 'modify' as const,
        priority: 'critical' as const,
        dependencies: [],
      },
      {
        id: 'step_2',
        title: 'Generate Code',
        description: 'Generate component or page based on requirements',
        action: 'create' as const,
        priority: 'high' as const,
        dependencies: ['step_1'],
      },
      {
        id: 'step_3',
        title: 'Validate Output',
        description: 'Validate syntax and accessibility',
        action: 'modify' as const,
        priority: 'high' as const,
        dependencies: ['step_2'],
      },
    ];

    return {
      id: `plan_${Date.now()}`,
      title: `Build Plan: ${intent.type}`,
      description: `Plan for ${prompt.substring(0, 80)}...`,
      steps: planSteps,
      estimatedComplexity: context.files.length > 10 ? 'complex' : 'simple',
      estimatedTokens: context.totalTokens,
      reasoning: `Intent: ${intent.type}, Files: ${context.files.length}, Tokens: ${context.totalTokens}`,
    };
  }

  /**
   * Generate code using LLM
   */
  private async generateCode(
    prompt: string,
    context: SelectedContext,
    plan?: BuildPlan,
    existingCode?: string,
  ): Promise<string> {
    // In production, this would call the AI provider with context and plan
    // For now, return a placeholder that the API will replace

    const contextFiles = context.files.map(f => `// ${f.path}`).join('\n');

    return `// Generated code for: ${prompt.substring(0, 50)}...
// Context: ${context.files.length} files
${plan ? '// Plan: ' + plan.title : ''}

${existingCode || 'export default function Component() { return <div>Generated Component</div> }'}`;
  }
}
