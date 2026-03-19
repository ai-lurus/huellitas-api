import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/auth';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await auth.api.getSession({ headers: req.headers as Record<string, string> });

    if (!session) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    req.user = session.user as Request['user'];
    next();
  } catch (err) {
    next(err);
  }
}
