import { createPetSchema } from '../../../src/schemas/pet.schemas';

describe('createPetSchema', () => {
  it('accepts a valid payload with required sex and optional age', () => {
    const parsed = createPetSchema.safeParse({
      name: 'Luna',
      species: 'cat',
      sex: 'female',
      breed: 'Siamese',
      age: 2,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.age).toBe(2);
      expect(parsed.data.sex).toBe('female');
    }
  });

  it('rejects name longer than 50 characters', () => {
    const parsed = createPetSchema.safeParse({
      name: 'x'.repeat(51),
      species: 'dog',
      sex: 'male',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects missing sex', () => {
    const parsed = createPetSchema.safeParse({
      name: 'Rex',
      species: 'dog',
    });
    expect(parsed.success).toBe(false);
  });

  it('coerces age from string when sent as JSON string', () => {
    const parsed = createPetSchema.safeParse({
      name: 'Rex',
      species: 'dog',
      sex: 'male',
      age: '3',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.age).toBe(3);
  });
});
