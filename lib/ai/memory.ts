import { ProjectMemory, GeneratedFile } from "./types";

export function buildProjectMemory(projectId: string, revision: string, files: GeneratedFile[]): ProjectMemory {
  return {
    version: "syra-memory-v1",
    projectId,
    revision,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    files: files.map(f => ({
      name: f.name,
      contentHash: "hash-placeholder",
      size: f.code.length,
      usedFor: f.usedFor || "",
      updatedAt: new Date(f.timestamp).toISOString(),
    })),
    summaries: [],
    routeMap: [],
    importGraph: [],
    designSystem: {
      colors: [],
      fonts: [],
      radius: [],
      tailwindPatterns: [],
      notes: "",
    },
    diagnostics: [],
    recentRequests: [],
    lastGoodBuild: null,
  };
}

export * from "./types";
