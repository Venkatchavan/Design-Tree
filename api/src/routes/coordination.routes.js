import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { requireInternal, requireRole } from '../middlewares/requireRole.js';
import { makeCrud } from '../utils/crud.js';
import { expandServices } from '../config/services.js';
import {
  CoordinationItem,
  COORDINATION_SERVICES,
} from '../models/CoordinationItem.js';

const create = z
  .object({
    project: z.string().regex(/^[a-f\d]{24}$/i),
    channel: z.enum([
      'Internal team',
      'Client',
      'Architect',
      'PMC',
      'Peer Review',
    ]),
    service: z.enum(COORDINATION_SERVICES),
    topic: z.string().trim().min(1).max(2000),
    deadline: z.coerce.date(),
  })
  .strict();
const crud = makeCrud(CoordinationItem, {
  create,
  update: z.object({ status: z.enum(['Open', 'Resolved']) }).strict(),
  scopedByProject: true,
  populate: [{ path: 'project', select: 'name code' }],
  filters: (req) => ({
    ...(req.query.project ? { project: req.query.project } : {}),
    ...(req.query.service
      ? { service: { $in: expandServices([req.query.service]) } }
      : {}),
  }),
  decorate: (body, req) => ({
    ...body,
    ...(req.method === 'POST' ? { createdBy: req.user.id } : {}),
  }),
});
const router = Router();
router.use(requireAuth);
router.get('/', requireInternal(), crud.list);
router.post(
  '/',
  requireRole('coordinator', 'design_mgmt_head', 'technical_director'),
  crud.create,
);
router.put(
  '/:id',
  requireRole('coordinator', 'design_mgmt_head', 'technical_director'),
  crud.update,
);
export default router;
