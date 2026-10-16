import path from 'node:path';
import { config as loadDotenvFile } from 'dotenv';
import { z } from 'zod';
import { ConfigError } from '../errors/app-error.js';

const booleanFromEnv = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z
    .enum(['true', 'false', '1', '0'])
    .default('true')
    .transform((value) => value === 'true' || value === '1'),
);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().min(1).default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  DEMO_MODE: booleanFromEnv,
  POLLING_INTERVAL_MS: z.coerce.number().int().min(5_000).max(3_600_000).default(15_000),
  PROVIDER_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(12_000),
  PROVIDER_MAX_RETRIES: z.coerce.number().int().min(0).max(8).default(3),
  USGS_API_URL: z
    .string()
    .url()
    .default('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson'),
  WILDFIRE_API_URL: z
    .string()
    .url()
    .default('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=200'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

function loadDotenv(): void {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(process.cwd(), '../../../.env'),
  ];
  for (const candidate of candidates) {
    loadDotenvFile({ path: candidate, quiet: true });
  }
}

function blankToUndefined(source: NodeJS.ProcessEnv): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, value === '' ? undefined : value]),
  );
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (source === process.env) {
    loadDotenv();
  }
  const parsed = envSchema.safeParse(blankToUndefined(source));
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `- ${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('\n');
    throw new ConfigError(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}

export function allowedOrigins(env: Env): string[] {
  return env.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
