import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import type { SystemStatusPayload } from '@sentinel/shared';
import Fastify, { type FastifyError } from 'fastify';
import type { WebSocket } from 'ws';
import { allowedOrigins, type Env } from './config/env.js';
import type { AppLogger } from './config/logger.js';
import { AppError } from './errors/app-error.js';
import type { IncidentRepository } from './repositories/types.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerIncidentRoutes } from './routes/incidents.js';
import { registerProviderRoutes } from './routes/providers.js';
import type { RealtimeHub } from './websocket/hub.js';

export interface AppDependencies {
  env: Env;
  logger: AppLogger | false;
  repository: IncidentRepository;
  hub: RealtimeHub;
  checkDatabase: () => Promise<boolean>;
  getSystemStatus: () => SystemStatusPayload;
  startedAt?: number;
}

function asWebSocket(socketOrConnection: unknown): WebSocket {
  if (
    socketOrConnection &&
    typeof socketOrConnection === 'object' &&
    'socket' in socketOrConnection &&
    socketOrConnection.socket
  ) {
    return socketOrConnection.socket as WebSocket;
  }
  return socketOrConnection as WebSocket;
}

export async function buildApp(deps: AppDependencies) {
  const app = Fastify({
    logger:
      deps.logger === false
        ? false
        : {
            level: deps.env.LOG_LEVEL,
            redact: {
              paths: ['req.headers.authorization', 'req.headers.cookie'],
              remove: true,
            },
            ...(deps.env.NODE_ENV === 'development'
              ? {
                  transport: {
                    target: 'pino-pretty',
                    options: { colorize: true, translateTime: 'SYS:standard' },
                  },
                }
              : {}),
          },
    trustProxy: true,
    genReqId: (request) => {
      const header = request.headers['x-request-id'];
      if (typeof header === 'string' && header.length > 0 && header.length < 128) {
        return header;
      }
      return crypto.randomUUID();
    },
    requestIdHeader: 'x-request-id',
  });

  const origins = allowedOrigins(deps.env);
  await app.register(cors, { origin: origins, methods: ['GET', 'OPTIONS'] });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { max: 600, timeWindow: '1 minute' });
  await app.register(websocket);

  const startedAt = deps.startedAt ?? Date.now();
  registerHealthRoutes(app, { env: deps.env, checkDatabase: deps.checkDatabase, startedAt });
  registerProviderRoutes(app, { getSystemStatus: deps.getSystemStatus });
  registerIncidentRoutes(app, deps.repository);

  app.get('/ws', { websocket: true }, (socketOrConnection, request) => {
    const origin = request.headers.origin;
    const socket = asWebSocket(socketOrConnection);
    if (origin && !origins.includes(origin)) {
      socket.close(1008, 'Origin not allowed');
      return;
    }
    deps.hub.add(socket);
    socket.send(
      JSON.stringify({
        type: 'SYSTEM_STATUS',
        timestamp: new Date().toISOString(),
        payload: deps.getSystemStatus(),
      }),
    );
    request.log.info({ clients: deps.hub.size }, 'websocket client connected');
    socket.on('close', () => {
      request.log.info({ clients: deps.hub.size }, 'websocket client disconnected');
    });
    socket.on('error', (error: unknown) => {
      request.log.warn({ err: error }, 'websocket client error');
    });
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
        details: null,
        requestId: request.id,
      },
    });
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof AppError) {
      request.log.info({ err: error, code: error.code }, 'request failed');
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId: request.id,
        },
      });
    }

    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 400 && statusCode < 500) {
      request.log.info({ err: error }, 'request rejected');
      return reply.status(statusCode).send({
        error: {
          code: statusCode === 429 ? 'RATE_LIMITED' : 'REQUEST_ERROR',
          message: statusCode === 429 ? 'Too many requests' : 'Request could not be processed',
          details: null,
          requestId: request.id,
        },
      });
    }

    request.log.error({ err: error }, 'unhandled error');
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: null,
        requestId: request.id,
      },
    });
  });

  return app;
}
