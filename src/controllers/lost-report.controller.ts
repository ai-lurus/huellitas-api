import { Request, Response, NextFunction } from 'express';
import { LostReportService } from '../services/lost-report.service';
import {
  createLostReportSchema,
  nearbyLostReportsQuerySchema,
} from '../schemas/lost-report.schemas';
import { UnauthorizedError, ValidationError } from '../utils/errors';

const service = new LostReportService();

function getUserId(req: Request): string {
  if (!req.user?.id) throw new UnauthorizedError();
  return req.user.id;
}

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

export async function postLostReport(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as unknown;
    const parsed = createLostReportSchema.safeParse(body);
    if (!parsed.success) {
      // Para coords inválidas, forzamos 400 como pidió el ticket.
      throw new ValidationError('Coordenadas inválidas');
    }

    const created = await service.createLostReport({
      userId: getUserId(req),
      petId: parsed.data.petId,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      lastSeenAt: new Date(parsed.data.lastSeenAt),
      message: parsed.data.message,
    });

    res.status(201).json({
      success: true,
      data: {
        id: created.id,
        petId: created.pet_id,
        userId: created.user_id,
        status: created.status,
        lastSeenAt: new Date(created.last_seen_at).toISOString(),
        message: created.message,
        createdAt: new Date(created.created_at).toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
}
