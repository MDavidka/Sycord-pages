import { ContextPack, GeneratedFile, ProjectMemory } from "./types";

export function buildContextPack(files: GeneratedFile[], memory: ProjectMemory | null, intent: any): ContextPack {
  const fullFiles: GeneratedFile[] = [];
  const summaryFiles: GeneratedFile[] = [];

  const coreFiles = ["package.json", "tsconfig.json", "app/globals.css", "app/layout.tsx", "lib/utils.ts", "lib/types.ts"];
  const intentFiles = intent?.targetFilesHint || [];

  for (const file of files) {
    if (coreFiles.includes(file.name) || intentFiles.includes(file.name)) {
      fullFiles.push(file);
    } else {
      summaryFiles.push(file);
    }
  }

  return {
    fullFiles,
    summaryFiles,
    designSystem: memory?.designSystem || { colors: [], fonts: [], radius: [], tailwindPatterns: [], notes: "" },
    routeMap: memory?.routeMap || [],
    importGraph: memory?.importGraph || [],
    availableShadcnComponents: [],
    dependencyReport: {},
    diagnostics: [],
    cacheStats: { systemPromptHit: false, cheatsheetHit: false, memoryHit: false, fileSummaryHits: 0, fileSummaryMisses: 0, planHit: false }
  };
}
