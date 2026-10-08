import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { config } from './config/config.js';
import authRoutes from './routes/auth.routes.js';
import billingRoutes from './routes/billing.routes.js';
import bookingsRoutes from './routes/bookings.routes.js';
import certificatesRoutes from './routes/certificates.routes.js';
import designmgmtRoutes from './routes/designmgmt.routes.js';
import documentsRoutes from './routes/documents.routes.js';
import employeesRoutes from './routes/employees.routes.js';
import leaveRoutes from './routes/leave.routes.js';
import marketingRoutes from './routes/marketing.routes.js';
import meetingsRoutes from './routes/meetings.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import portalRoutes from './routes/portal.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import supportRoutes from './routes/support.routes.js';
import registerRoutes from './routes/register.routes.js';
import metaRoutes from './routes/meta.routes.js';
import projectsRoutes from './routes/projects.routes.js';
import functionsRoutes from './routes/functions.routes.js';
import financeOccRoutes from './routes/financeOcc.routes.js';
import transmittalsRoutes from './routes/transmittals.routes.js';
import spocRoutes from './routes/spoc.routes.js';
import teamsRoutes from './routes/teams.routes.js';
import workflowRoutes from './routes/workflow.routes.js';
import usersRoutes from './routes/users.routes.js';
import workEntriesRoutes from './routes/workEntries.routes.js';

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
  app.use('/api/meta', metaRoutes);
  app.use('/api/projects', projectsRoutes);
  app.use('/api/employees', employeesRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/teams', teamsRoutes);
  app.use('/api/work', workflowRoutes);
  app.use('/api/functions', functionsRoutes);
  app.use('/api/spoc', spocRoutes);
  app.use('/api/work-entries', workEntriesRoutes);
  app.use('/api/transmittals', transmittalsRoutes);
  app.use('/api/transmittal-register', registerRoutes);
  app.use('/api/billing', billingRoutes);
  app.use('/api/finance-occ', financeOccRoutes);
  app.use('/api/certificates', certificatesRoutes);
  app.use('/api/travel-bookings', bookingsRoutes);
  app.use('/api/design', designmgmtRoutes);
  app.use('/api/marketing', marketingRoutes);
  app.use('/api/leave-travel', leaveRoutes);
  app.use('/api/support', supportRoutes);
  app.use('/api/meetings', meetingsRoutes);
  app.use('/api/portal', portalRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/reports', reportsRoutes);
  // Document files are served ONLY through auth-checked download routes
  // (certificates, templates, visits, bills, employees, marketing).
  // No public static file serving.
  app.use('/api/documents', documentsRoutes);

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
