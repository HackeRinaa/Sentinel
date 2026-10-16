import { realtimeEventSchema, type RealtimeEvent } from '@sentinel/shared';
import type { ConnectionStatus } from '@/stores/connection-store';

interface RealtimeListener {
  onEvent: (event: RealtimeEvent) => void;
  onStatus: (status: ConnectionStatus) => void;
}

let socket: WebSocket | null = null;
let attempt = 0;
let reconnectTimer: number | null = null;
let suppressReconnect = false;
const listeners = new Set<RealtimeListener>();

function emitStatus(status: ConnectionStatus): void {
  for (const listener of listeners) {
    listener.onStatus(status);
  }
}

function clearReconnectTimer(): void {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(): void {
  clearReconnectTimer();
  attempt += 1;
  emitStatus(attempt >= 3 ? 'offline' : 'reconnecting');
  const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
  reconnectTimer = window.setTimeout(() => {
    connect();
  }, delay);
}

function connect(): void {
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const next = new WebSocket(`${protocol}://${window.location.host}/ws`);
  socket = next;
  emitStatus(attempt === 0 ? 'connecting' : 'reconnecting');

  next.onopen = () => {
    attempt = 0;
    emitStatus('connected');
  };

  next.onmessage = (message) => {
    try {
      const parsed = realtimeEventSchema.safeParse(JSON.parse(String(message.data)));
      if (!parsed.success) {
        return;
      }
      for (const listener of listeners) {
        listener.onEvent(parsed.data);
      }
    } catch {
      // Ignore malformed frames. The next valid event still updates the dashboard.
    }
  };

  next.onerror = () => {
    next.close();
  };

  next.onclose = () => {
    if (socket === next) {
      socket = null;
    }
    if (suppressReconnect || listeners.size === 0) {
      return;
    }
    scheduleReconnect();
  };
}

export function startRealtime(listener: RealtimeListener): () => void {
  listeners.add(listener);
  suppressReconnect = false;
  connect();
  listener.onStatus(
    socket?.readyState === WebSocket.OPEN
      ? 'connected'
      : attempt > 0
        ? 'reconnecting'
        : 'connecting',
  );
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      suppressReconnect = true;
      clearReconnectTimer();
      socket?.close();
      socket = null;
      attempt = 0;
    }
  };
}
