import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { expandServices } from '../config/services.js';
import { allocationOptions } from './allocationOptions.js';

// Design Management Head assignment options (17 Nov 2026). Besides SMEPF, which
// goes to a Design Coordinator (SPOC), a project can be assigned for:
//  - MEPF services: a TL / PTL / ATD of Mechanical, Electrical, Plumbing or Fire
//  - STR services:  a TL / PTL / ATD of Structural
//  - Peer Review:   a Peer Review login or an employee saved under Peer Review
// Every list is read from the saved employee records and login roles.
export const SERVICE_ASSIGNMENTS = {
  MEPF: ['Mechanical', 'Electrical', 'Plumbing', 'Fire'],
  STR: ['Structural'],
};
export const PEER_REVIEW = 'Peer Review';
export const ASSIGN_OPTIONS = ['SMEPF', 'MEPF', 'STR', PEER_REVIEW];

const PEER_REVIEW_ROLES = ['peer_reviewer', 'peer_review_head'];
const PEER_REVIEW_TEXT = /\bpeer\s*review/i;
const id = (value) => String(value?._id ?? value ?? '');
const person = (e) => ({
  _id: id(e),
  firstName: e.firstName,
  middleName: e.middleName,
  lastName: e.lastName,
  empId: e.empId,
  designation: e.designation,
  department: e.department,
  branch: e.branch,
});
const byName = (a, b) => [a.firstName, a.lastName].join(' ').localeCompare([b.firstName, b.lastName].join(' '));

// Services of a person from the saved department, plus the discipline written
// after the dash in the designation (e.g. "Associate Technical Director - HVAC").
function servicesOf(e) {
  const discipline = String(e.designation ?? '').split(/\s+-\s+/).slice(1).join(' - ');
  return expandServices([e.department, discipline].filter(Boolean));
}

export async function serviceAssignOptions() {
  const [{ teamLeads }, employees, users] = await Promise.all([
    allocationOptions(),
    Employee.find({ status: { $ne: 'Exited' } }).select('firstName middleName lastName empId designation department branch').lean(),
    User.find({ role: { $in: PEER_REVIEW_ROLES }, isActive: { $ne: false }, employee: { $ne: null } }).select('employee').lean(),
  ]);
  const leadsFor = (services) => teamLeads
    .filter((lead) => servicesOf(lead).some((service) => services.includes(service)))
    .map(person)
    .sort(byName);
  const reviewerLogins = new Set(users.map((u) => id(u.employee)));
  const peerReview = employees
    .filter((e) => reviewerLogins.has(id(e)) || PEER_REVIEW_TEXT.test(`${e.department ?? ''} ${e.designation ?? ''}`))
    .map(person)
    .sort(byName);
  return {
    MEPF: leadsFor(SERVICE_ASSIGNMENTS.MEPF),
    STR: leadsFor(SERVICE_ASSIGNMENTS.STR),
    [PEER_REVIEW]: peerReview,
  };
}
