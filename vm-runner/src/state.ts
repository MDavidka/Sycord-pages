import fs from 'fs/promises';
import path from 'path';
import { paths } from './paths';

export interface ProjectState {
  projectId: string;
  subdomain: string;
  domain: string;
  port: number;
  processName: string;
  status: 'running' | 'stopped' | 'failed' | 'building';
  health: 'healthy' | 'unhealthy' | 'unknown';
  lastDeployAt?: string;
  lastHealthCheckAt?: string;
  lastError?: string;
  restartCount?: number;
}

export interface RunnerState {
  websites: Record<string, ProjectState>;
}

export const loadState = async (): Promise<RunnerState> => {
  try {
    const data = await fs.readFile(paths.stateFile, 'utf8');
    return JSON.parse(data) as RunnerState;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return { websites: {} };
    }
    console.error('Failed to load state:', error);
    return { websites: {} };
  }
};

export const saveState = async (state: RunnerState): Promise<void> => {
  try {
    await fs.mkdir(path.dirname(paths.stateFile), { recursive: true });
    await fs.writeFile(paths.stateFile, JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save state:', error);
  }
};

export const updateProjectState = async (projectId: string, update: Partial<ProjectState>): Promise<ProjectState> => {
  const state = await loadState();
  const current = state.websites[projectId] || {
    projectId,
    status: 'stopped',
    health: 'unknown',
  };

  state.websites[projectId] = { ...current, ...update } as ProjectState;
  await saveState(state);
  return state.websites[projectId];
};

export const getProjectState = async (projectId: string): Promise<ProjectState | null> => {
  const state = await loadState();
  return state.websites[projectId] || null;
};

export const removeProjectState = async (projectId: string): Promise<void> => {
  const state = await loadState();
  if (state.websites[projectId]) {
    delete state.websites[projectId];
    await saveState(state);
  }
};
