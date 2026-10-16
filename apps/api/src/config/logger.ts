import { pino, type Logger } from 'pino';
import type { Env } from './env.js';

export type AppLogger = Logger;

export function createLogger(env: Pick<Env, 'LOG_LEVEL' | 'NODE_ENV'>): AppLogger {
  return pino({
    level: env.LOG_LEVEL,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'DATABASE_URL'],
      remove: true,
    },
    ...(env.NODE_ENV === 'development'
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:standard' },
          },
        }
      : {}),
  });
}
