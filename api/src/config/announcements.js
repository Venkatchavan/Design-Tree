import { DIRECTOR_ROLES, ROLE_KEYS } from './roles.js';
import { expandServices } from './services.js';

export const ANNOUNCEMENT_SENDERS = [
  'admin_billing', 'founding_director', 'working_director', 'executive_director',
  'associate_director', 'technical_director', 'assoc_technical_director',
];
export const ANNOUNCEMENT_READERS = ROLE_KEYS.filter(
  role => !['client', 'architect', 'superuser'].includes(role),
);

// Service / department-wise audiences. A person belongs to one when their login
// role is listed, or their employee department (or, for Design Management, the
// designation) matches. Service names use the same aliases as project services.
const norm = v => String(v ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const DESIGN_MGMT_DEPARTMENTS = ['design management', 'design mgmt', 'design coordination', 'coordination', 'design management coordination', 'design management & coordination', 'design management and coordination'];
const inDepartments = (list) => (u) => list.includes(norm(u.employee?.department));
const inService = (name) => (u) => expandServices([u.employee?.department]).includes(name);
export const ANNOUNCEMENT_SERVICES = [
  { key: 'admin', label: 'Admin', match: u => u.role === 'admin_billing' || inDepartments(['admin', 'administration'])(u) },
  { key: 'spoc', label: 'SPOC', match: u => u.role === 'coordinator' },
  { key: 'hr', label: 'HR', match: u => u.role === 'hr' || inDepartments(['hr', 'human resources'])(u) },
  { key: 'str', label: 'STR', match: inService('Structural') },
  { key: 'phe', label: 'PHE', match: inService('Plumbing') },
  { key: 'ele', label: 'ELE', match: inService('Electrical') },
  { key: 'hvac', label: 'HVAC', match: inService('Mechanical') },
  { key: 'fire', label: 'FIRE', match: inService('Fire') },
  { key: 'bim', label: 'BIM', match: u => ['bim', 'bim_head'].includes(u.role) || inService('BIM')(u) },
  { key: 'qs', label: 'QS', match: u => ['qs', 'qs_head'].includes(u.role) || inDepartments(['qs'])(u) },
  { key: 'qaqc', label: 'QA/QC', match: u => ['qaqc', 'qaqc_head'].includes(u.role) || inDepartments(['qa/qc', 'qaqc', 'qa qc'])(u) },
  { key: 'design-management', label: 'Design Management', match: u => u.role === 'design_mgmt_head' || inDepartments(DESIGN_MGMT_DEPARTMENTS)(u) },
  { key: 'directors', label: 'Directors', match: u => DIRECTOR_ROLES.includes(u.role) },
];
export const announcementServiceOptions = () => ANNOUNCEMENT_SERVICES.map(({ key, label }) => ({ key, label }));
