-- Asegura índices geoespaciales (PostGIS) para location
CREATE EXTENSION IF NOT EXISTS postgis;

-- User location (puede faltar en DBs antiguas)
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS location GEOGRAPHY(POINT, 4326);
CREATE INDEX IF NOT EXISTS idx_user_location ON "user" USING GIST(location);

-- Lost reports location (por compatibilidad)
ALTER TABLE lost_reports ADD COLUMN IF NOT EXISTS location GEOGRAPHY(POINT, 4326);
CREATE INDEX IF NOT EXISTS idx_lost_reports_location ON lost_reports USING GIST(location);

