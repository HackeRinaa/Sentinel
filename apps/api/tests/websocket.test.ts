import type { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { describe, expect, it } from 'vitest';
import { createTestApp, makeNormalized } from './helpers.js';
import { toDomainIncident } from '../src/repositories/change-detection.js';

function waitForMessage(socket: WebSocket): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('timed out waiting for websocket message')),
      4_000,
    );
    socket.once('message', (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
    });
  });
}

describe('websocket hub', () => {
  it('sends system status on connect and forwards incident events', async () => {
    const { app, hub } = await createTestApp();
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address() as AddressInfo;
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
    const first = waitForMessage(socket);
    await once(socket, 'open');
    const connected = (await first) as { type: string };
    expect(connected.type).toBe('SYSTEM_STATUS');

    const incident = toDomainIncident('id-1', makeNormalized(), {
      createdAt: new Date('2026-10-05T12:00:00.000Z'),
      updatedAt: new Date('2026-10-05T12:00:00.000Z'),
      resolvedAt: null,
    });
    const second = waitForMessage(socket);
    hub.broadcast({
      type: 'INCIDENT_CREATED',
      timestamp: '2026-10-05T12:01:00.000Z',
      payload: { incident },
    });
    const created = (await second) as { type: string; payload: { incident: { id: string } } };
    expect(created.type).toBe('INCIDENT_CREATED');
    expect(created.payload.incident.id).toBe('id-1');
    expect(hub.size).toBe(1);

    socket.close();
    await once(socket, 'close');
    await app.close();
  });
});
