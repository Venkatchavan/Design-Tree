import { io } from 'socket.io-client';
import { API_BASE } from './api.js';

// Singleton socket.io client for live bell pushes (2A: badge only).
// Same-origin in production (gateway proxies /socket.io/); in dev the
// vite proxy forwards it to the API (see vite.config.js).
// The 60s REST polling in NotifBell stays as the fallback when the
// socket is down, so a failed WS never breaks notifications.
let socket = null;
let connected = false;
const listeners = new Set();

export function isRealtimeConnected() {
  return connected;
}

export function getSocket() {
  if (socket) return socket;
  socket = io(API_BASE || undefined, {
    path: '/socket.io/',
    withCredentials: true,
    reconnection: true,
    reconnectionDelay: 2000,
    timeout: 10000,
  });
  socket.on('connect', () => {
    connected = true;
  });
  socket.on('disconnect', () => {
    connected = false;
  });
  socket.on('connect_error', () => {
    connected = false;
  });
  socket.on('notification', (payload) => {
    for (const fn of [...listeners]) {
      try {
        fn(payload);
      } catch {
        /* one bad listener must not break the rest */
      }
    }
  });
  return socket;
}

export function subscribeNotifications(fn) {
  getSocket();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
