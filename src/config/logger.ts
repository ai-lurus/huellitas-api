import winston from 'winston';

const { combine, timestamp, json, colorize, printf } = winston.format;

const isDev = process.env['NODE_ENV'] !== 'production';

const devFormat = combine(
  colorize(),
  timestamp(),
  printf((info) => {
    const requestId = (info as Record<string, unknown>)['requestId'];
    const userId = (info as Record<string, unknown>)['userId'];
    const meta = { ...info } as Record<string, unknown>;
    delete meta['level'];
    delete meta['message'];
    delete meta['timestamp'];

    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    const rid = requestId ? ` requestId=${String(requestId)}` : '';
    const uid = userId ? ` userId=${String(userId)}` : '';
    return `${info.timestamp as string} ${info.level}:${rid}${uid} ${info.message}${metaStr}`;
  }),
);

export const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  // JSON in production; colorized, human-friendly in development.
  // Both formats always include a timestamp; requestId/userId are passed in log calls.
  format: isDev ? devFormat : combine(timestamp(), json()),
  transports: [new winston.transports.Console()],
});
