import { Request, Response, NextFunction } from 'express';
import { LostReportService } from '../services/lost-report.service';
import {
  CreateLostReportInput,
  CreateSightingInput,
  NearbyLostReportsQuery,
} from '../schemas/lost-report.schemas';
import { UnauthorizedError } from '../utils/errors';

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
    const { lat, lng, radius, species } = req.query as unknown as NearbyLostReportsQuery;
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

function reportIdParam(req: Request): string {
  return req.params['id'] as string;
}

export async function getLostReportDetail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await service.getDetail(reportIdParam(req));
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
    const body = req.body as CreateLostReportInput;
    const created = await service.createLostReport({
      userId: getUserId(req),
      petId: body.petId,
      lat: body.lat,
      lng: body.lng,
      lastSeenAt: new Date(body.lastSeenAt),
      message: body.message,
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

function getUploadedPhotos(req: Request): Express.Multer.File[] {
  const grouped = req.files as
    | Record<string, Express.Multer.File[]>
    | Express.Multer.File[]
    | undefined;
  if (!grouped) return [];
  if (Array.isArray(grouped)) return grouped;
  return grouped['photos'] ?? grouped['photo'] ?? grouped['image'] ?? grouped['file'] ?? [];
}

export async function postSighting(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as CreateSightingInput;
    const sighting = await service.addSighting({
      reportId: reportIdParam(req),
      reporterId: getUserId(req),
      lat: body.lat,
      lng: body.lng,
      message: body.message,
      files: getUploadedPhotos(req),
    });

    res.status(201).json({ success: true, data: sighting });
  } catch (err) {
    next(err);
  }
}

export async function patchResolve(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.resolve({ reportId: reportIdParam(req), userId: getUserId(req) });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getSightings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await service.listSightingsOwnerOnly({
      reportId: reportIdParam(req),
      userId: getUserId(req),
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
