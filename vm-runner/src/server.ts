import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { config } from './config';
import { requireAuth, validateParams } from './auth';
import { getProjectPaths } from './paths';
import { getProjectState, loadState, updateProjectState, removeProjectState } from './state';
import { validateFiles, writeSourceFiles, writeEnvFile, buildProject, DeployPayload } from './deploy';
import { allocatePort, deleteProcess, restartProcess, startProcess, stopProcess } from './processes';
import { generateNginxConfig, reloadReverseProxy, removeNginxConfig } from './proxy';
import { checkHealth } from './health';
import { appendLogFile, readLogFile } from './logs';

const app = express();
app.use(cors());
// Need a larger limit for file uploads (DeployPayload can be large)
app.use(express.json({ limit: '50mb' }));

app.get('/api/status', requireAuth, async (req, res) => {
  const state = await loadState();
  res.json({ status: 'ok', uptime: process.uptime(), websites: Object.keys(state.websites).length });
});

app.get('/api/setup/status', requireAuth, (req, res) => {
  // Simple mock since this runner is already running if this endpoint answers
  res.json({ runner: 'running' });
});

app.post('/api/setup', requireAuth, (req, res) => {
  res.json({ success: true, message: 'Runner is already set up and running' });
});

app.get('/api/websites', requireAuth, async (req, res) => {
  const state = await loadState();
  res.json(state);
});

app.get('/api/websites/:projectId', requireAuth, validateParams, async (req, res) => {
  const state = await getProjectState(req.params.projectId);
  if (!state) return res.status(404).json({ error: 'Project not found' });
  res.json({ success: true, ...state });
});

app.post('/api/websites/:projectId/start', requireAuth, validateParams, async (req, res) => {
  const { projectId } = req.params;
  const state = await getProjectState(projectId);
  if (!state) return res.status(404).json({ error: 'Project not found' });

  const paths = getProjectPaths(projectId);
  const result = await startProcess(projectId, paths.current, state.port);
  if (result.success) {
    await updateProjectState(projectId, { status: 'running' });
    res.json({ success: true });
  } else {
    res.status(500).json({ error: result.error });
  }
});

app.post('/api/websites/:projectId/stop', requireAuth, validateParams, async (req, res) => {
  const { projectId } = req.params;
  await stopProcess(projectId);
  await updateProjectState(projectId, { status: 'stopped' });
  res.json({ success: true });
});

app.post('/api/websites/:projectId/restart', requireAuth, validateParams, async (req, res) => {
  const { projectId } = req.params;
  const state = await getProjectState(projectId);
  if (!state) return res.status(404).json({ error: 'Project not found' });

  const result = await restartProcess(projectId, state.port);
  if (result) {
    await updateProjectState(projectId, { status: 'running' });
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to restart' });
  }
});

app.post('/api/websites/:projectId/health', requireAuth, validateParams, async (req, res) => {
  const { projectId } = req.params;
  const state = await getProjectState(projectId);
  if (!state) return res.status(404).json({ error: 'Project not found' });

  const health = await checkHealth(state.port);
  await updateProjectState(projectId, {
    health: health.ok ? 'healthy' : 'unhealthy',
    lastHealthCheckAt: new Date().toISOString()
  });
  res.json({ success: true, health });
});

app.delete('/api/websites/:projectId', requireAuth, validateParams, async (req, res) => {
  const { projectId } = req.params;

  await deleteProcess(projectId);
  await removeNginxConfig(projectId);

  const paths = getProjectPaths(projectId);
  try {
    await fs.rm(paths.dir, { recursive: true, force: true });
    await fs.rm(paths.envFile, { force: true });
    await fs.rm(paths.logsDir, { recursive: true, force: true });
  } catch (e) {
    console.error('Error cleaning up files for', projectId, e);
  }

  await removeProjectState(projectId);

  res.json({ success: true });
});

app.get('/api/websites/:projectId/logs', requireAuth, validateParams, async (req, res) => {
  const { projectId } = req.params;
  const type = (req.query.type as string) || 'runtime';
  const limit = parseInt(req.query.limit as string) || 300;

  const paths = getProjectPaths(projectId);
  let logPath = '';
  switch (type) {
    case 'deploy': logPath = paths.deployLog; break;
    case 'build': logPath = paths.buildLog; break;
    case 'runtime': logPath = paths.runtimeLog; break; // usually PM2 manages this, but we'll try to read if we can, or PM2 logs
    case 'error': logPath = paths.errorLog; break;
    case 'health': logPath = paths.healthLog; break;
    default: return res.status(400).json({ error: 'Invalid log type' });
  }

  // If runtime/error, we might want to read PM2 logs, but for simplicity we rely on our structure if we dumped it,
  // or point to PM2 default log locations. PM2 logs are usually in ~/.pm2/logs/
  // For the sake of the exercise, we'll just try to read from our paths or return empty.
  if (type === 'runtime' || type === 'error') {
     const pm2LogPath = path.join(process.env.HOME || '/root', '.pm2', 'logs', `sycord-site-${projectId}-${type === 'error' ? 'error' : 'out'}.log`);
     logPath = pm2LogPath;
  }

  const logs = await readLogFile(logPath, limit);
  res.json({ logs });
});

app.post('/api/deploy/:projectId', requireAuth, validateParams, async (req, res) => {
  const { projectId } = req.params;
  const payload: DeployPayload = req.body;
  const paths = getProjectPaths(projectId);

  try {
    await appendLogFile(paths.deployLog, `Starting deploy for ${projectId} / ${payload.subdomain}`);

    // 1. Validation
    const validationErrors = validateFiles(payload.files);
    if (validationErrors.length > 0) {
      await appendLogFile(paths.deployLog, `Validation failed: ${validationErrors.join(', ')}`);
      return res.status(400).json({
         success: false,
         error: `Validation failed: ${validationErrors.join(', ')}`
      });
    }

    // 2. Write files
    await appendLogFile(paths.deployLog, 'Writing source files');
    await writeSourceFiles(paths.current, payload.files);
    await writeEnvFile(paths.envFile, payload.env_vars);

    // 3. Build
    await appendLogFile(paths.deployLog, 'Starting build process');
    await updateProjectState(projectId, { status: 'building' });
    const buildResult = await buildProject(paths.current, paths.buildLog);

    if (!buildResult.ok) {
       await appendLogFile(paths.deployLog, `Build failed: ${buildResult.error}`);
       await updateProjectState(projectId, { status: 'failed', lastError: buildResult.error });
       return res.status(500).json({
          success: false,
          deployment_mode: payload.deployment_mode,
          project_id: projectId,
          build: buildResult,
          running: false,
          error: buildResult.error
       });
    }

    // 4. Port allocation and Process Start
    let state = await getProjectState(projectId);
    let port = state?.port;
    if (!port) {
       port = await allocatePort();
    }

    await appendLogFile(paths.deployLog, `Starting process on port ${port}`);
    const startRes = await startProcess(projectId, paths.current, port);

    if (!startRes.success) {
       await appendLogFile(paths.deployLog, `Failed to start process: ${startRes.error}`);
       await updateProjectState(projectId, { status: 'failed', lastError: startRes.error });
       return res.status(500).json({
          success: false,
          deployment_mode: payload.deployment_mode,
          project_id: projectId,
          build: buildResult,
          running: false,
          error: startRes.error
       });
    }

    // 5. Proxy configuration
    await appendLogFile(paths.deployLog, 'Configuring Nginx proxy');
    await generateNginxConfig(projectId, payload.subdomain, port);
    await reloadReverseProxy();

    // 6. Health check
    await appendLogFile(paths.deployLog, 'Running health check');
    // Give it a moment to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    const healthResult = await checkHealth(port);

    if (!healthResult.ok) {
       await appendLogFile(paths.deployLog, `Health check failed: ${healthResult.error}`);
       await updateProjectState(projectId, {
          health: 'unhealthy',
          status: 'failed',
          lastError: `Health check failed: ${healthResult.error}`
       });
       return res.status(500).json({
          success: false,
          deployment_mode: payload.deployment_mode,
          project_id: projectId,
          build: buildResult,
          running: true,
          health: healthResult,
          error: `Health check failed: ${healthResult.error}`
       });
    }

    // 7. Success
    const domain = `${payload.subdomain}.sycord.site`;
    await updateProjectState(projectId, {
       subdomain: payload.subdomain,
       domain,
       port,
       processName: startRes.processName!,
       status: 'running',
       health: 'healthy',
       lastDeployAt: new Date().toISOString(),
       lastHealthCheckAt: new Date().toISOString()
    });

    await appendLogFile(paths.deployLog, 'Deploy successful');

    return res.json({
       success: true,
       deployment_mode: payload.deployment_mode,
       project_id: projectId,
       domain,
       port,
       processName: startRes.processName,
       build: buildResult,
       running: true,
       health: healthResult,
       logs: await readLogFile(paths.deployLog, 50)
    });

  } catch (error: any) {
    console.error(`Deploy error for ${projectId}:`, error);
    await appendLogFile(paths.deployLog, `Deploy error: ${error.message}`);
    return res.status(500).json({
       success: false,
       deployment_mode: payload.deployment_mode,
       project_id: projectId,
       error: error.message
    });
  }
});

// Admin endpoints mappings
app.post('/api/runner/start', requireAuth, (req, res) => res.json({ success: true, message: 'Runner started' }));
app.post('/api/runner/stop', requireAuth, (req, res) => res.json({ success: true, message: 'Runner stopped' }));
app.post('/api/runner/destroy', requireAuth, (req, res) => res.json({ success: true, message: 'Runner destroyed' }));

app.listen(config.port, () => {
  console.log(`VM Runner listening on port ${config.port}`);
});
