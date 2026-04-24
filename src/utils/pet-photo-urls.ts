/**
 * Normaliza entradas de `pets.photos` (TEXT[]) a URLs absolutas listas para el cliente.
 *
 * @param publicBase URL pública del bucket (p. ej. `env.R2_PUBLIC_URL` sin slash final), o `null` si no hay base (solo se devolverán URLs ya absolutas).
 */
export function normalizePetPhotoUrlString(
  raw: string | null | undefined,
  publicBase: string | null,
): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  if (/^https?:\/\//i.test(s)) {
    try {
      const url = new URL(s);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      return url.href;
    } catch {
      return null;
    }
  }

  if (s.startsWith('//')) {
    try {
      return new URL(`https:${s}`).href;
    } catch {
      return null;
    }
  }

  const base = publicBase?.replace(/\/$/, '') ?? '';
  if (!base) return null;

  if (s.startsWith('/')) return `${base}${s}`;
  return `${base}/${s}`;
}

/**
 * @param publicBase Igual que en {@link normalizePetPhotoUrlString}.
 * @returns URLs absolutas en el mismo orden que el arreglo en BD.
 */
export function normalizePetGalleryUrls(
  photos: string[] | null | undefined,
  publicBase: string | null,
): string[] {
  if (!photos?.length) return [];
  const out: string[] = [];
  for (const raw of photos) {
    const u = normalizePetPhotoUrlString(raw, publicBase);
    if (u) out.push(u);
  }
  return out;
}
