-- Onboarding gate: NULL = usuario debe ver el flujo de 3 pasos
ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN "user".onboarding_completed_at IS 'Cuando el usuario terminó u omitió el onboarding; NULL = pendiente.';
