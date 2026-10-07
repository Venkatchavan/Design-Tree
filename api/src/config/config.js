import dotenv from 'dotenv';

dotenv.config();

function required(name, value) {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 5000),
  mongoUri:
    process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/designtree',
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  cookieName: process.env.COOKIE_NAME ?? 'token',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  seedName: process.env.SEED_NAME ?? '',
  seedEmail: (process.env.SEED_EMAIL ?? '').toLowerCase().trim(),
  seedPassword: process.env.SEED_PASSWORD ?? '',
};

export function requireJwtSecret() {
  return required('JWT_SECRET', config.jwtSecret);
}
