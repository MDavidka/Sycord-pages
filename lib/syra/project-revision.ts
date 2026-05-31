import crypto from 'crypto';

export interface ProjectFile {
  path: string;
  content: string;
  mtime: number;
}

export interface ProjectRevision {
  hash: string;
  timestamp: number;
  fileCount: number;
  totalSize: number;
}

/**
 * Compute a deterministic hash of the entire project
 * Used to determine if cached AI memory is still valid
 */
export function computeProjectRevision(files: ProjectFile[]): ProjectRevision {
  const fileHashes = files
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(f => {
      const fileHash = crypto
        .createHash('sha256')
        .update(f.content)
        .digest('hex');
      return `${f.path}:${fileHash}`;
    });

  const combinedHash = crypto
    .createHash('sha256')
    .update(fileHashes.join('\n'))
    .digest('hex');

  const totalSize = files.reduce((sum, f) => sum + f.content.length, 0);

  return {
    hash: combinedHash,
    timestamp: Date.now(),
    fileCount: files.length,
    totalSize,
  };
}

/**
 * Check if two revisions are the same
 */
export function isSameRevision(rev1: ProjectRevision, rev2: ProjectRevision): boolean {
  return rev1.hash === rev2.hash;
}
