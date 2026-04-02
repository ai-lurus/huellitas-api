import { Request, Response, NextFunction } from 'express';
import { PetService } from '../services/pet.service';
import { CreatePetInput, UpdatePetInput } from '../schemas/pet.schemas';
import { UnauthorizedError } from '../utils/errors';

const service = new PetService();

function getUserId(req: Request): string {
  if (!req.user?.id) throw new UnauthorizedError();
  return req.user.id;
}

export async function listPets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pets = await service.listPets(getUserId(req));
    res.json({ success: true, data: pets });
  } catch (err) {
    next(err);
  }
}

export async function createPet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as CreatePetInput;
    const pet = await service.createPet(getUserId(req), body);
    res.status(201).json({ success: true, data: pet });
  } catch (err) {
    next(err);
  }
}

export async function getPet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pet = await service.getPet(req.params['id'], getUserId(req));
    res.json({ success: true, data: pet });
  } catch (err) {
    next(err);
  }
}

export async function updatePet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as UpdatePetInput;
    const pet = await service.updatePet(req.params['id'], getUserId(req), body);
    res.json({ success: true, data: pet });
  } catch (err) {
    next(err);
  }
}

export async function deletePet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.deletePet(req.params['id'], getUserId(req));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function uploadPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file provided' });
      return;
    }
    const pet = await service.addPhoto(req.params['id'], getUserId(req), req.file);
    res.status(201).json({ success: true, data: pet });
  } catch (err) {
    next(err);
  }
}
