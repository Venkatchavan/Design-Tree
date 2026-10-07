import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { config } from './config/config.js';
import authRoutes from './routes/auth.routes.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: config.clientOrigin,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.use('/api/auth', authRoutes);

  app.use((req, res) => {
    res.status(404).json({ message: `Not found: ${req.method} ${req.path}` });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    const status = err.status ?? err.statusCode ?? 500;
    const message =
      status >= 500 ? 'Internal server error.' : err.message || 'Bad request.';
    res.status(status).json({ message });
  });

  return app;
}
