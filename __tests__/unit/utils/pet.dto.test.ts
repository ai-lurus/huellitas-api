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
    expect(petToListItem(basePet).coverPhotoUrl).toBeNull();
  });

  it('coverPhotoUrl es la primera URL de photos', () => {
    const pet: Pet = {
      ...basePet,
      photos: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
    };
    expect(petToApi(pet).coverPhotoUrl).toBe('https://cdn.example.com/a.jpg');
    expect(petToListItem(pet).coverPhotoUrl).toBe('https://cdn.example.com/a.jpg');
  });
});
