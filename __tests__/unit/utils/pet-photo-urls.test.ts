import {
  normalizePetGalleryUrls,
  normalizePetPhotoUrlString,
} from '../../../src/utils/pet-photo-urls';

describe('normalizePetPhotoUrlString', () => {
  it('deja https absolutas válidas', () => {
    expect(normalizePetPhotoUrlString('https://cdn.example.com/a.jpg', null)).toBe(
      'https://cdn.example.com/a.jpg',
    );
  });

  it('resuelve path absoluto con base', () => {
    expect(normalizePetPhotoUrlString('/pets/x.jpg', 'https://r2.example.com')).toBe(
      'https://r2.example.com/pets/x.jpg',
    );
  });

  it('resuelve key relativa con base', () => {
    expect(normalizePetPhotoUrlString('pets/uuid.jpg', 'https://r2.example.com')).toBe(
      'https://r2.example.com/pets/uuid.jpg',
    );
  });

  it('protocol-relative -> https', () => {
    expect(normalizePetPhotoUrlString('//cdn.example.com/a.jpg', null)).toBe(
      'https://cdn.example.com/a.jpg',
    );
  });

  it('sin base no resuelve paths relativos', () => {
    expect(normalizePetPhotoUrlString('pets/x.jpg', null)).toBeNull();
  });
});

describe('normalizePetGalleryUrls', () => {
  it('filtra vacíos y conserva orden', () => {
    const base = 'https://cdn.example.com';
    expect(
      normalizePetGalleryUrls(['https://cdn.example.com/1.jpg', '', '  ', 'pets/2.jpg'], base),
    ).toEqual(['https://cdn.example.com/1.jpg', 'https://cdn.example.com/pets/2.jpg']);
  });

  it('array vacío', () => {
    expect(normalizePetGalleryUrls([], 'https://x.com')).toEqual([]);
  });

  it('sin base solo conserva URLs ya absolutas', () => {
    expect(normalizePetGalleryUrls(['https://a.com/1.jpg', 'rel/path.jpg'], null)).toEqual([
      'https://a.com/1.jpg',
    ]);
  });
});
