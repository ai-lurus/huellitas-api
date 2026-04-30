import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import {
  PatchUserProfileInput,
  UpdateLocationInput,
  UpdateUserSettingsInput,
  RegisterPushTokenInput,
} from '../schemas/user.schemas';
import { UnauthorizedError } from '../utils/errors';

const service = new UserService();

function getUserId(req: Request): string {
  if (!req.user?.id) throw new UnauthorizedError();
  return req.user.id;
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await service.getProfile(getUserId(req));
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

export async function patchMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = (req.body ?? {}) as PatchUserProfileInput;

    // multipart/form-data: si viene archivo `image`, primero lo subimos y lo tratamos como `image: <url>`
    const grouped = req.files as Record<string, Express.Multer.File[]> | undefined;
    const file = grouped?.['image']?.[0] ?? grouped?.['photo']?.[0] ?? grouped?.['file']?.[0];
    if (file) {
      const { url } = await service.uploadAvatar(getUserId(req), file);
      body.image = url;
    }
    const profile = await service.updateProfile(getUserId(req), body);
    // Respuesta plana (shape igual a GET /users/me)
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

export async function postAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No se envió ningún archivo' });
      return;
    }
    const result = await service.uploadAvatar(getUserId(req), req.file);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function patchLocation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as UpdateLocationInput;
    const data = await service.updateLocation(getUserId(req), body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function patchSettings(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as UpdateUserSettingsInput;
    const profile = await service.updateSettings(getUserId(req), body);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

export async function postPushToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as RegisterPushTokenInput;
    await service.registerPushToken(getUserId(req), body);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function deletePushToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await service.deletePushTokens(getUserId(req));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function deleteMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.deleteAccount(getUserId(req));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
