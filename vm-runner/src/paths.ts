import path from 'path';

export const BASE_DIR = process.env.BASE_DIR || '/srv/sycord';

export const paths = {
  sites: path.join(BASE_DIR, 'sites'),
  env: path.join(BASE_DIR, 'env'),
  logs: path.join(BASE_DIR, 'logs'),
  runner: path.join(BASE_DIR, 'runner'),
  proxy: path.join(BASE_DIR, 'proxy'),
  stateFile: path.join(BASE_DIR, 'runner', 'state.json'),
};

export const getProjectPaths = (projectId: string) => {
  const currentDir = path.join(paths.sites, projectId, 'current');
  return {
    dir: path.join(paths.sites, projectId),
    current: currentDir,
    envFile: path.join(paths.env, `${projectId}.env`),
    logsDir: path.join(paths.logs, projectId),
    deployLog: path.join(paths.logs, projectId, 'deploy.log'),
    buildLog: path.join(paths.logs, projectId, 'build.log'),
    runtimeLog: path.join(paths.logs, projectId, 'runtime.log'),
    errorLog: path.join(paths.logs, projectId, 'error.log'),
    healthLog: path.join(paths.logs, projectId, 'health.log'),
  };
};
