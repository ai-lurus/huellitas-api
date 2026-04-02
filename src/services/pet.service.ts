import { PetRepository, Pet, CreatePetData, UpdatePetData } from '../repositories/pet.repository';
import { uploadFile } from './storage.service';
import {
  ForbiddenError,
  LimitExceededError,
  NotFoundError,
  ValidationError,
} from '../utils/errors';

const MAX_PETS_PER_USER = 3;
const MAX_PHOTOS_PER_PET = 5;

export class PetService {
  private repo: PetRepository;

  constructor(repo?: PetRepository) {
    this.repo = repo ?? new PetRepository();
  }

  async listPets(userId: string): Promise<Pet[]> {
    return this.repo.findByUserId(userId);
  }

  async createPet(userId: string, data: Omit<CreatePetData, 'user_id'>): Promise<Pet> {
    const count = await this.repo.countByUserId(userId);
    if (count >= MAX_PETS_PER_USER) {
      throw new LimitExceededError(`Maximum of ${MAX_PETS_PER_USER} pets per user allowed`);
    }
    return this.repo.create({ ...data, user_id: userId });
  }

  async getPet(petId: string, userId: string): Promise<Pet> {
    const pet = await this.repo.findById(petId);
    if (!pet) throw new NotFoundError('Pet not found');
    if (pet.user_id !== userId) throw new ForbiddenError();
    return pet;
  }

  async updatePet(petId: string, userId: string, data: UpdatePetData): Promise<Pet> {
    const pet = await this.repo.findById(petId);
    if (!pet) throw new NotFoundError('Pet not found');
    if (pet.user_id !== userId) throw new ForbiddenError();
    const updated = await this.repo.update(petId, data);
    if (!updated) throw new NotFoundError('Pet not found');
    return updated;
  }

  async deletePet(petId: string, userId: string): Promise<void> {
    const pet = await this.repo.findById(petId);
    if (!pet) throw new NotFoundError('Pet not found');
    if (pet.user_id !== userId) throw new ForbiddenError();
    await this.repo.softDelete(petId);
  }

  async addPhoto(petId: string, userId: string, file: Express.Multer.File): Promise<Pet> {
    const pet = await this.repo.findById(petId);
    if (!pet) throw new NotFoundError('Pet not found');
    if (pet.user_id !== userId) throw new ForbiddenError();
    if (pet.photos.length >= MAX_PHOTOS_PER_PET) {
      throw new ValidationError(`Maximum of ${MAX_PHOTOS_PER_PET} photos per pet allowed`);
    }

    const photoUrl = await uploadFile(
      file.buffer,
      `pets/${petId}`,
      file.originalname,
      file.mimetype,
    );

    const updated = await this.repo.addPhoto(petId, photoUrl);
    if (!updated) throw new NotFoundError('Pet not found');
    return updated;
  }
}
