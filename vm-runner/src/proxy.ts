import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import util from 'util';
import { paths } from './paths';

const execAsync = util.promisify(exec);

export const generateNginxConfig = async (projectId: string, subdomain: string, port: number) => {
  if (!/^[a-zA-Z0-9-]+$/.test(subdomain)) throw new Error('Invalid subdomain');
  if (!/^[a-zA-Z0-9-]+$/.test(projectId)) throw new Error('Invalid projectId');
  const domain = `${subdomain}.sycord.site`;
  const configContent = `
server {
  listen 80;
  server_name ${domain};

  location / {
    proxy_pass http://127.0.0.1:${port};
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 300;
    proxy_connect_timeout 300;
    proxy_send_timeout 300;
  }
}
`;

  const configPath = path.join(paths.proxy, `${projectId}.conf`);

  try {
    await fs.mkdir(paths.proxy, { recursive: true });
    await fs.writeFile(configPath, configContent, 'utf8');

    // In production, you would typically link this to /etc/nginx/sites-enabled/
    // For this mini-server, we assume the Nginx config includes the sycord proxy directory
    // e.g., include /srv/sycord/proxy/*.conf;

    return true;
  } catch (error) {
    console.error(`Failed to generate Nginx config for ${projectId}:`, error);
    return false;
  }
};

export const reloadReverseProxy = async () => {
  try {
    const { stdout, stderr } = await execAsync('nginx -t');
    if (stderr && !stderr.includes('syntax is ok') && !stderr.includes('test is successful')) {
       console.error('Nginx config test warning:', stderr);
    }

    await execAsync('systemctl reload nginx || service nginx reload');
    return true;
  } catch (error) {
    console.error('Failed to reload Nginx:', error);
    // If not running as root or systemctl fails, try to just signal it
    try {
      await execAsync('nginx -s reload');
      return true;
    } catch (e) {
      console.error('Failed to fallback reload Nginx:', e);
      return false;
    }
  }
};

export const removeNginxConfig = async (projectId: string) => {
  if (!/^[a-zA-Z0-9-]+$/.test(projectId)) throw new Error('Invalid projectId');
  const configPath = path.join(paths.proxy, `${projectId}.conf`);
  try {
    await fs.unlink(configPath);
    await reloadReverseProxy();
    return true;
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      console.error(`Failed to remove Nginx config for ${projectId}:`, error);
      return false;
    }
    return true;
  }
};
