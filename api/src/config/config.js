import dotenv from 'dotenv';

dotenv.config();

function required(name, value) {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const rawOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const config = {
  port: Number(process.env.PORT ?? 5000),
  mongoUri:
    process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/designtree',
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  cookieName: process.env.COOKIE_NAME ?? 'token',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  clientOrigin: rawOrigins[0] ?? 'http://localhost:5173',
  // Dual-origin: comma-separated CLIENT_ORIGIN allowlist so the LAN IP and
  // the public IP can serve the same gateway in parallel. Each browser
  // session is still same-origin (SPA + /api share one host), so the
  // host-only Lax cookie needs no change — only CORS/socket need the list.
  clientOrigins: rawOrigins.length ? rawOrigins : ['http://localhost:5173'],
  seedName: process.env.SEED_NAME ?? '',
  seedEmail: (process.env.SEED_EMAIL ?? '').toLowerCase().trim(),
  seedPassword: process.env.SEED_PASSWORD ?? '',
};

export function requireJwtSecret() {
  return required('JWT_SECRET', config.jwtSecret);
}

export function isAllowedOrigin(origin) {
  // No Origin header (curl, health checks, same-origin navigations):
  // not a CORS request, always pass through.
  if (!origin) return true;
  return config.clientOrigins.includes(origin);
}
