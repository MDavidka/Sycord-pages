import { ProjectRevision } from './project-revision';

export interface FileMetadata {
  path: string;
  type: 'component' | 'page' | 'api' | 'lib' | 'config' | 'other';
  imports: string[];
  exports: string[];
  size: number;
  lastModified: number;
}

export interface RouteMap {
  [route: string]: {
    file: string;
    type: 'page' | 'api' | 'layout';
    children?: string[];
  };
}

export interface ImportGraph {
  [fromFile: string]: string[];
}

export interface DesignSystem {
  colors: string[];
  typography: {
    sans?: string;
    serif?: string;
    mono?: string;
  };
  spacing: string[];
  borderRadius: string[];
}

export interface AIMemory {
  projectRevision: ProjectRevision;
  fileMetadata: FileMetadata[];
  routeMap: RouteMap;
  importGraph: ImportGraph;
  designSystem: DesignSystem;
  lastUpdated: number;
  cacheHitCount: number;
}

/**
 * Initialize empty AI memory structure
 */
export function createEmptyMemory(revision: ProjectRevision): AIMemory {
  return {
    projectRevision: revision,
    fileMetadata: [],
    routeMap: {},
    importGraph: {},
    designSystem: {
      colors: [],
      typography: {},
      spacing: [],
      borderRadius: [],
    },
    lastUpdated: Date.now(),
    cacheHitCount: 0,
  };
}

/**
 * Build file metadata from project files
 */
export function buildFileMetadata(
  path: string,
  content: string,
): FileMetadata {
  const type = inferFileType(path);
  const imports = extractImports(content);
  const exports = extractExports(content);

  return {
    path,
    type,
    imports,
    exports,
    size: content.length,
    lastModified: Date.now(),
  };
}

/**
 * Extract import statements from file content
 */
function extractImports(content: string): string[] {
  const importRegex = /(?:import|require)\s+(?:.*?from\s+)?['"]([^'"]+)['"]/g;
  const imports: string[] = [];
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

/**
 * Extract export statements from file content
 */
function extractExports(content: string): string[] {
  const exportRegex = /export\s+(?:default\s+)?(?:function|class|const)\s+(\w+)/g;
  const exports: string[] = [];
  let match;

  while ((match = exportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }

  return exports;
}

/**
 * Infer file type from path
 */
function inferFileType(
  path: string,
): 'component' | 'page' | 'api' | 'lib' | 'config' | 'other' {
  if (path.includes('/api/')) return 'api';
  if (path.includes('/app/') && path.includes('page.')) return 'page';
  if (path.includes('/components/')) return 'component';
  if (path.includes('/lib/')) return 'lib';
  if (
    path.includes('next.config') ||
    path.includes('tailwind.config') ||
    path.includes('tsconfig')
  ) {
    return 'config';
  }
  return 'other';
}

/**
 * Build import graph from file metadata
 */
export function buildImportGraph(metadata: FileMetadata[]): ImportGraph {
  const graph: ImportGraph = {};

  for (const file of metadata) {
    const localImports = file.imports
      .filter(imp => !imp.startsWith('react') && !imp.startsWith('@'))
      .map(imp => {
        // Resolve relative imports to absolute paths
        if (imp.startsWith('.')) {
          const basePath = file.path.substring(0, file.path.lastIndexOf('/'));
          return `${basePath}/${imp}`;
        }
        return imp;
      });

    if (localImports.length > 0) {
      graph[file.path] = localImports;
    }
  }

  return graph;
}

/**
 * Extract design system tokens from globals.css or theme config
 */
export function extractDesignSystem(cssContent: string): DesignSystem {
  const colors: string[] = [];
  const spacing: string[] = [];
  const borderRadius: string[] = [];

  // Extract CSS variables
  const varRegex = /--(\w+):\s*([^;]+);/g;
  let match;

  while ((match = varRegex.exec(cssContent)) !== null) {
    const [, name, value] = match;

    if (name.includes('color') || name.includes('bg') || name.includes('text')) {
      colors.push(value.trim());
    } else if (name.includes('spacing') || name.includes('gap') || name.includes('pad')) {
      spacing.push(value.trim());
    } else if (name.includes('radius')) {
      borderRadius.push(value.trim());
    }
  }

  return {
    colors: [...new Set(colors)],
    typography: { sans: 'font-sans', serif: 'font-serif', mono: 'font-mono' },
    spacing: [...new Set(spacing)],
    borderRadius: [...new Set(borderRadius)],
  };
}

/**
 * Increment cache hit counter
 */
export function recordCacheHit(memory: AIMemory): AIMemory {
  return {
    ...memory,
    cacheHitCount: memory.cacheHitCount + 1,
    lastUpdated: Date.now(),
  };
}
