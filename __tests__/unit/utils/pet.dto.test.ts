jest.mock('../../../src/config/env', () => ({
  env: { R2_PUBLIC_URL: 'https://cdn.unit-test.example' },
}));

import { petToApi, petToListItem } from '../../../src/utils/pet.dto';
import type { Pet } from '../../../src/repositories/pet.repository';

const basePet: Pet = {
  id: '00000000-0000-0000-0000-000000000001',
  user_id: 'user-1',
  name: 'Luna',
  species: 'cat',
  breed: null,
  color: null,
  sex: 'female',
  age_years: 2,
  notes: null,
  photos: [],
  is_lost: false,
  deleted_at: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-02T00:00:00.000Z'),
};

describe('pet.dto', () => {
  it('coverPhotoUrl es null sin fotos', () => {
    const dto = petToApi(basePet);
    expect(dto.coverPhotoUrl).toBeNull();
    expect(dto.photos).toEqual([]);
    expect(petToListItem(basePet).coverPhotoUrl).toBeNull();
  });

  it('normaliza path relativo de BD con R2_PUBLIC_URL (mock)', () => {
    const pet: Pet = {
      ...basePet,
      photos: ['/pets/only-relative.jpg'],
    };
    expect(petToApi(pet).photos).toEqual(['https://cdn.unit-test.example/pets/only-relative.jpg']);
    expect(petToApi(pet).coverPhotoUrl).toBe(
      'https://cdn.unit-test.example/pets/only-relative.jpg',
    );
  });

  it('coverPhotoUrl es la primera URL de photos', () => {
    const pet: Pet = {
      ...basePet,
      photos: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
    };
    expect(petToApi(pet).coverPhotoUrl).toBe('https://cdn.example.com/a.jpg');
    expect(petToListItem(pet).coverPhotoUrl).toBe('https://cdn.example.com/a.jpg');
    expect(petToApi(pet).photos).toHaveLength(2);
  });
});
