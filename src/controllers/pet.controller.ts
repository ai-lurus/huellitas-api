import { Request, Response, NextFunction } from 'express';
import { PetService } from '../services/pet.service';
import { CreatePetInput, UpdatePetInput } from '../schemas/pet.schemas';
import { UnauthorizedError } from '../utils/errors';
import { petToApi, petToListItem } from '../utils/pet.dto';
import type { CreatePetData, UpdatePetData } from '../repositories/pet.repository';

const service = new PetService();

function getUserId(req: Request): string {
  if (!req.user?.id) throw new UnauthorizedError();
  return req.user.id;
}

function petIdParam(req: Request): string {
  return req.params['petId'] as string;
}

function createBodyToRepo(body: CreatePetInput): Omit<CreatePetData, 'user_id'> {
  const { age, ...rest } = body;
  return {
    ...rest,
    age_years: age,
  };
}

function updateBodyToRepo(body: UpdatePetInput): UpdatePetData {
  const { age, ...rest } = body;
  const data: UpdatePetData = { ...rest };
  if (age !== undefined) data.age_years = age;
  return data;
}

export async function listPets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pets = await service.listPets(getUserId(req));
    res.json({ success: true, data: pets.map(petToListItem) });
  } catch (err) {
    next(err);
  }
}

export async function createPet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as CreatePetInput;
    const pet = await service.createPet(getUserId(req), createBodyToRepo(body));
    res.status(201).json({ success: true, data: petToApi(pet) });
  } catch (err) {
    next(err);
  }
}

export async function getPet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pet = await service.getPet(petIdParam(req), getUserId(req));
    res.json({ success: true, data: petToApi(pet) });
  } catch (err) {
    next(err);
  }
}

export async function updatePet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as UpdatePetInput;
    const pet = await service.updatePet(petIdParam(req), getUserId(req), updateBodyToRepo(body));
    res.json({ success: true, data: petToApi(pet) });
  } catch (err) {
    next(err);
  }
}

export async function deletePet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.deletePet(petIdParam(req), getUserId(req));
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
    const result = await service.addPhoto(petIdParam(req), getUserId(req), req.file);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
