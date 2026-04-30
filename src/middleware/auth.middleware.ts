import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/auth';
import * as Sentry from '@sentry/node';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await auth.api.getSession({ headers: req.headers as Record<string, string> });

    if (!session) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    req.user = session.user as Request['user'];
    // Attach user to Sentry scope (no PII).
    Sentry.setUser({ id: session.user.id });
    next();
  } catch (err) {
    next(err);
  }
}
