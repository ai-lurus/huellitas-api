-- Extiende sightings para soportar múltiples fotos (compatible con columna legacy photo_url)
ALTER TABLE sightings
  ADD COLUMN IF NOT EXISTS photos TEXT[] NOT NULL DEFAULT '{}';

