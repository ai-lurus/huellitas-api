import winston from 'winston';

const { combine, timestamp, json, colorize, printf } = winston.format;

const isDev = process.env['NODE_ENV'] !== 'production';

const REDACT_KEYS = /password|authorization|cookie|token|secret|refresh_token|access_token/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT_KEYS.test(k) ? '[REDACTED]' : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

const redactFormat = winston.format((info) => redact(info) as winston.Logform.TransformableInfo);

const devFormat = combine(
  colorize(),
  timestamp(),
  redactFormat(),
  printf((info) => {
    const requestId = (info as Record<string, unknown>)['requestId'];
    const userId = (info as Record<string, unknown>)['userId'];
    const method = (info as Record<string, unknown>)['method'];
    const url = (info as Record<string, unknown>)['url'];
    const meta = { ...info } as Record<string, unknown>;
    delete meta['level'];
    delete meta['message'];
    delete meta['timestamp'];

    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    const rid = requestId ? ` requestId=${String(requestId)}` : '';
    const uid = userId ? ` userId=${String(userId)}` : '';
    const route = method && url ? ` ${String(method)} ${String(url)}` : '';
    return `${info.timestamp as string} ${info.level}:${rid}${uid}${route} ${info.message}${metaStr}`;
  }),
);

export const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  // JSON in production; colorized, human-friendly in development.
  // Both formats always include a timestamp; requestId/userId are passed in log calls.
  format: isDev ? devFormat : combine(timestamp(), redactFormat(), json()),
  transports: [new winston.transports.Console()],
});
