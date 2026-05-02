import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  token: process.env.VPS_RUNNER_TOKEN || '',
  isDev: process.env.NODE_ENV !== 'production',
};

if (!config.token && !config.isDev) {
  console.warn('WARNING: VPS_RUNNER_TOKEN is not set in production!');
}
