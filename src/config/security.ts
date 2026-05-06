import type { HelmetOptions } from 'helmet';
import type { CorsOptions } from 'cors';
import { corsAllowedOrigins } from './env';

export const helmetOptions: HelmetOptions = {
  // CSP básica. La API no sirve assets, así que 'self' basta.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  // HSTS 1 año
  hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
  // Evita embedding
  frameguard: { action: 'deny' },
};

export const corsOptions: CorsOptions = {
  origin: corsAllowedOrigins,
  credentials: true,
};
