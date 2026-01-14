import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Generate a short random token if not provided via env (8 chars for easy mobile typing)
const AUTH_TOKEN = process.env.CLAUDE_REMOTE_TOKEN || crypto.randomBytes(4).toString('hex');

export function getAuthToken(): string {
  return AUTH_TOKEN;
}

// Express middleware for HTTP routes
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Check Authorization header first, then query param (for iframes)
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;

  let token: string | undefined;

  if (authHeader) {
    token = authHeader.replace('Bearer ', '');
  } else if (queryToken) {
    token = queryToken;
  }

  if (!token) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }

  if (token !== AUTH_TOKEN) {
    res.status(403).json({ error: 'Invalid token' });
    return;
  }

  next();
}

// Validate token for WebSocket connections
export function validateToken(token: string): boolean {
  return token === AUTH_TOKEN;
}
