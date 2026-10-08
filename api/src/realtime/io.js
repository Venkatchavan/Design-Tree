import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { config } from '../config/config.js';

let io = null;

function parseCookies(header) {
  const out = {};
  for (const part of String(header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k && !(k in out)) out[k] = decodeURIComponent(v);
  }
  return out;
}

// Live push for the in-app bell. Same cookie JWT as the REST API —
// anonymous sockets are rejected at the handshake, and each connection
// joins exactly its own user room plus its role room, so relevance
// targeting from Notification (users[] / roles[]) maps 1:1 to delivery.
export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    path: '/socket.io/',
    cors: { origin: config.clientOrigin, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie ?? '');
      const token = cookies[config.cookieName];
      if (!token) return next(new Error('unauthorized'));
      const payload = jwt.verify(token, config.jwtSecret);
      if (!payload?.sub) return next(new Error('unauthorized'));
      socket.data.user = {
        id: String(payload.sub),
        email: payload.email,
        role: payload.role,
      };
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const u = socket.data.user;
    if (!u) return;
    socket.join(`user:${u.id}`);
    if (u.role) socket.join(`role:${u.role}`);
  });

  return io;
}

export function emitNotification(doc) {
  if (!io || !doc) return;
  const rooms = new Set();
  for (const r of doc.roles ?? []) {
    if (r) rooms.add(`role:${r}`);
  }
  for (const u of doc.users ?? []) {
    const s = String(u?._id ?? u ?? '');
    if (s) rooms.add(`user:${s}`);
  }
  if (rooms.size === 0) return;
  io.to([...rooms]).emit('notification', {
    id: String(doc._id),
    title: doc.title,
    detail: doc.detail,
    type: doc.type,
    at: doc.createdAt,
    link:
      doc.link?.view || doc.link?.id
        ? { view: doc.link.view, id: doc.link.id }
        : undefined,
  });
}
