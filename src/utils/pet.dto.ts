import type { Pet } from '../repositories/pet.repository';
import { env } from '../config/env';
import { normalizePetGalleryUrls } from './pet-photo-urls';

function r2PublicBase(): string | null {
  return env.R2_PUBLIC_URL?.replace(/\/$/, '') ?? null;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export type PetApiDto = {
  id: string;
  userId: string;
  name: string;
  species: Pet['species'];
  breed: string | null;
  color: string | null;
  sex: Pet['sex'];
  age: number | null;
  notes: string | null;
  /** URLs absolutas `https://…` (o `http://` en dev), orden estable = orden en BD. */
  photos: string[];
  /** Primera foto normalizada de la galería (miniatura en lista/tarjeta). */
  coverPhotoUrl: string | null;
  isLost: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

/** Elemento de lista (sin `userId`). */
export type PetListItemDto = Omit<PetApiDto, 'userId'>;

/** Formato API (camelCase) para el cliente móvil. */
export function petToApi(pet: Pet): PetApiDto {
  const photos = normalizePetGalleryUrls(pet.photos, r2PublicBase());
  return {
    id: pet.id,
    userId: pet.user_id,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    color: pet.color,
    sex: pet.sex,
    age: pet.age_years != null ? Math.round(Number(pet.age_years)) : null,
    notes: pet.notes,
    photos,
    coverPhotoUrl: photos[0] ?? null,
    isLost: pet.is_lost,
    createdAt: toIso(pet.created_at),
    updatedAt: toIso(pet.updated_at),
  };
}

/** Lista: mínimo id, name, species; breed e isLost según ticket (incluimos más campos útiles). */
export function petToListItem(pet: Pet): PetListItemDto {
  const photos = normalizePetGalleryUrls(pet.photos, r2PublicBase());
  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    isLost: pet.is_lost,
    color: pet.color,
    sex: pet.sex,
    age: pet.age_years != null ? Math.round(Number(pet.age_years)) : null,
    notes: pet.notes,
    photos,
    coverPhotoUrl: photos[0] ?? null,
    createdAt: toIso(pet.created_at),
    updatedAt: toIso(pet.updated_at),
  };
}
