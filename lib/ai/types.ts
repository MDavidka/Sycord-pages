export type Mode = "generate" | "edit" | "fix" | "auto";

export interface GeneratedFile {
  name: string;
  code: string;
  timestamp: number;
  usedFor?: string;
  contentHash?: string;
  size?: number;
}

export interface BuildPlan {
  mode: Mode;
  title: string;
  summary: string;
  userIntent: string;
  designDirection: {
    style: string;
    colors: string[];
    layout: string;
    tone: string;
    responsiveBehavior: string;
  };
  filesToCreate: { name: string; usedFor: string; reason: string; priority: number }[];
  filesToModify: { name: string; usedFor: string; reason: string; priority: number }[];
  filesToDelete: string[];
  filesToMove: { from: string; to: string; reason: string }[];
  routes: { path: string; file: string; purpose: string }[];
  components: { name: string; file: string; purpose: string }[];
  dependencies: string[];
  validationFocus: string[];
  risks: string[];
}

export interface Diagnostic {
  file: string;
  severity: "error" | "warning";
  code: string;
  message: string;
  suggestedFix?: string;
}

export interface ProjectMemory {
  version: string;
  projectId: string;
  revision: string;
  createdAt: string;
  updatedAt: string;
  files: {
    name: string;
    contentHash: string;
    size: number;
    usedFor: string;
    updatedAt: string;
  }[];
  summaries: {
    name: string;
    role: string;
    route: string;
    summary: string;
    exports: string[];
    imports: string[];
    components: string[];
    shadcn: string[];
    designTokens: string[];
  }[];
  routeMap: { route: string; file: string }[];
  importGraph: { from: string; to: string }[];
  designSystem: {
    colors: string[];
    fonts: string[];
    radius: string[];
    tailwindPatterns: string[];
    notes: string;
  };
  diagnostics: Diagnostic[];
  recentRequests: any[];
  lastGoodBuild: string | null;
}

export interface ParsedFileChangeSet {
  upserts: { name: string; content: string; usedFor: string }[];
  deletes: string[];
  moves: { from: string; to: string }[];
  parserWarnings: Diagnostic[];
}

export interface IntentResult {
  mode: Mode;
  confidence: number;
  reason: string;
  targetFilesHint: string[];
  destructive: boolean;
}

export interface CacheStats {
  systemPromptHit: boolean;
  cheatsheetHit: boolean;
  memoryHit: boolean;
  fileSummaryHits: number;
  fileSummaryMisses: number;
  planHit: boolean;
}

export interface ContextPack {
  fullFiles: GeneratedFile[];
  summaryFiles: GeneratedFile[];
  designSystem: ProjectMemory["designSystem"];
  routeMap: ProjectMemory["routeMap"];
  importGraph: ProjectMemory["importGraph"];
  availableShadcnComponents: string[];
  dependencyReport: Record<string, string>;
  diagnostics: Diagnostic[];
  cacheStats: CacheStats;
}
