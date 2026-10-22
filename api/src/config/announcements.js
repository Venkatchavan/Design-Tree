import { ROLE_KEYS } from './roles.js';

export const ANNOUNCEMENT_SENDERS = [
  'admin_billing', 'founding_director', 'working_director', 'executive_director',
  'associate_director', 'technical_director', 'assoc_technical_director',
];
export const ANNOUNCEMENT_READERS = ROLE_KEYS.filter(
  role => !['client', 'architect', 'superuser'].includes(role),
);
