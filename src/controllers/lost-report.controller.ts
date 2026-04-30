import { Request, Response, NextFunction } from 'express';
import { LostReportService } from '../services/lost-report.service';
import { nearbyLostReportsQuerySchema } from '../schemas/lost-report.schemas';
import { ValidationError } from '../utils/errors';

const service = new LostReportService();

export async function getNearbyLostReports(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = nearbyLostReportsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError('Coordenadas inválidas');
    }

    const { lat, lng, radius, species } = parsed.data;
    const data = await service.nearby({
      lat,
      lng,
      radiusKm: radius,
      species,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
