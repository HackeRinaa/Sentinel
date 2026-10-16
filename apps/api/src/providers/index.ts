import type { Env } from '../config/env.js';
import { createDemoProvider } from './demo-provider.js';
import { EonetProvider } from './eonet.js';
import type { IncidentProvider } from './types.js';
import { UsgsEarthquakeProvider } from './usgs.js';

export function createProviders(env: Env): IncidentProvider[] {
  if (env.DEMO_MODE) {
    return [createDemoProvider()];
  }
  return [
    new UsgsEarthquakeProvider(env.USGS_API_URL, env.PROVIDER_TIMEOUT_MS),
    new EonetProvider(env.WILDFIRE_API_URL, env.PROVIDER_TIMEOUT_MS),
  ];
}
