import { exec } from 'child_process';
import util from 'util';
import { loadState } from './state';

const execAsync = util.promisify(exec);

export const startProcess = async (projectId: string, currentDir: string, port: number) => {
  if (!/^[a-zA-Z0-9-]+$/.test(projectId)) return { success: false, error: 'Invalid projectId' };
  const processName = `sycord-site-${projectId}`;
  try {
    // Check if process already exists
    const { stdout } = await execAsync(`pm2 jlist`);
    const pm2List = JSON.parse(stdout);
    const exists = pm2List.some((p: any) => p.name === processName);

    if (exists) {
       await execAsync(`PORT=${port} pm2 restart ${processName} --update-env`, { cwd: currentDir });
    } else {
       await execAsync(`PORT=${port} pm2 start npm --name ${processName} -- run start`, { cwd: currentDir });
    }

    await execAsync(`pm2 save`);
    return { success: true, processName };
  } catch (error: any) {
    console.error(`Failed to start process for ${projectId}:`, error);
    return { success: false, error: error.message };
  }
};

export const stopProcess = async (projectId: string) => {
  if (!/^[a-zA-Z0-9-]+$/.test(projectId)) return false;
  const processName = `sycord-site-${projectId}`;
  try {
    await execAsync(`pm2 stop ${processName}`);
    return true;
  } catch (error) {
    console.error(`Failed to stop process for ${projectId}:`, error);
    return false;
  }
};

export const deleteProcess = async (projectId: string) => {
  if (!/^[a-zA-Z0-9-]+$/.test(projectId)) return false;
  const processName = `sycord-site-${projectId}`;
  try {
    await execAsync(`pm2 delete ${processName}`);
    await execAsync(`pm2 save`);
    return true;
  } catch (error: any) {
    if (error.stderr && error.stderr.includes('not found')) {
       return true;
    }
    console.error(`Failed to delete process for ${projectId}:`, error);
    return false;
  }
};

export const restartProcess = async (projectId: string, port: number) => {
  if (!/^[a-zA-Z0-9-]+$/.test(projectId)) return false;
    const processName = `sycord-site-${projectId}`;
    try {
        await execAsync(`PORT=${port} pm2 restart ${processName} --update-env`);
        return true;
    } catch (error) {
        console.error(`Failed to restart process for ${projectId}:`, error);
        return false;
    }
};

export const allocatePort = async (): Promise<number> => {
   const state = await loadState();
   const usedPorts = Object.values(state.websites).map(w => w.port).filter(Boolean);
   let port = 4100;
   while (usedPorts.includes(port)) {
       port++;
   }
   return port;
};
