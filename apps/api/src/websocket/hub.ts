import type { RealtimeEvent } from '@sentinel/shared';
import { WebSocket } from 'ws';

export class RealtimeHub {
  private readonly clients = new Set<WebSocket>();

  add(socket: WebSocket): void {
    this.clients.add(socket);
    socket.on('close', () => {
      this.clients.delete(socket);
    });
  }

  broadcast(event: RealtimeEvent): void {
    const message = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState !== WebSocket.OPEN) {
        continue;
      }
      try {
        client.send(message);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  get size(): number {
    return this.clients.size;
  }
}
