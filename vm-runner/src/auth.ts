import { Request, Response, NextFunction } from 'express';
import { config } from './config';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!config.token) {
    if (config.isDev) {
      return next(); // Skip auth in dev if token is not set
    }
    return res.status(500).json({ error: 'Server configuration error: Token not set' });
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
  }

  const token = authHeader.split(' ')[1];
  if (token !== config.token) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  next();
};

export const validateParams = (req: Request, res: Response, next: NextFunction) => {
  const { projectId } = req.params;
  const subdomain = req.body?.subdomain;

  const safePattern = /^[a-zA-Z0-9-]+$/;

  if (projectId && (!safePattern.test(projectId) || projectId.length > 50)) {
     return res.status(400).json({ error: 'Invalid projectId format' });
  }

  if (subdomain && (!safePattern.test(subdomain) || subdomain.length > 50)) {
     return res.status(400).json({ error: 'Invalid subdomain format' });
  }

  next();
};
