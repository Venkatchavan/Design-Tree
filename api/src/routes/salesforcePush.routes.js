import { Router } from 'express';
import { receiveSalesforcePush } from '../controllers/salesforcePush.controller.js';

// Mounted before the session-protected Salesforce router: authentication here
// is the HMAC signature, checked in the controller against the raw body.
const router = Router();

router.post('/', receiveSalesforcePush);

export default router;
