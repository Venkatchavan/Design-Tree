/**
 * Cast of 11 workflow logins (§1.3-§1.4) + Founding Director (§0.4).
 * Password for all 11 test logins: Test@1234 (§0.5).
 */

export const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'Test@1234';

export const FD = {
  email: process.env.E2E_FD_EMAIL ?? 'founding.director@designtree.com',
};

export interface CastMember {
  key: string;
  firstName: string;
  lastName: string;
  designation: string;
  department: string;
  branch: string;
  dateOfJoining: string; // YYYY-MM-DD
  email: string;
  role: string; // Role dropdown value (login role key label mapping in HR form)
}

/**
 * Role dropdown values must match api/src/config/roles.js ROLE_KEYS labels
 * as rendered by the HR form. Verified keys:
 * admin_billing, design_mgmt_head, team_lead, coordinator,
 * engineer_drafter, qs, qaqc, bim, client, architect.
 */
export const CAST: CastMember[] = [
  { key: 'admin', firstName: 'Vikram', lastName: 'Rao', designation: 'Administrator', department: 'Admin', branch: 'Bengaluru HQ', dateOfJoining: '2023-04-01', email: 'admin@designtree.test', role: 'admin_billing' },
  { key: 'dmh', firstName: 'Divya', lastName: 'Nair', designation: 'Design Management Head', department: 'Design Management', branch: 'Bengaluru HQ', dateOfJoining: '2023-04-01', email: 'design.head@designtree.test', role: 'design_mgmt_head' },
  { key: 'tlStruct', firstName: 'Arjun', lastName: 'Reddy', designation: 'Team Lead, Structural', department: 'Structural', branch: 'Bengaluru HQ', dateOfJoining: '2023-06-01', email: 'tl.struct@designtree.test', role: 'team_lead' },
  { key: 'spoc', firstName: 'Ananya', lastName: 'Rao', designation: 'Coordinator (SPOC)', department: 'MEP Coordination', branch: 'Bengaluru HQ', dateOfJoining: '2023-06-01', email: 'spoc@designtree.test', role: 'coordinator' },
  { key: 'engStruct', firstName: 'Karthik', lastName: 'Nair', designation: 'Senior Structural Engineer', department: 'Structural', branch: 'Bengaluru HQ', dateOfJoining: '2024-01-10', email: 'eng.struct@designtree.test', role: 'engineer_drafter' },
  { key: 'engMech', firstName: 'Meera', lastName: 'Shetty', designation: 'Mechanical Designer', department: 'Mechanical', branch: 'Bengaluru HQ', dateOfJoining: '2024-02-01', email: 'eng.mech@designtree.test', role: 'engineer_drafter' },
  { key: 'qs', firstName: 'Deepa', lastName: 'Kulkarni', designation: 'QS Lead', department: 'QS', branch: 'Bengaluru HQ', dateOfJoining: '2023-08-01', email: 'qs@designtree.test', role: 'qs' },
  { key: 'qa', firstName: 'Ravi', lastName: 'Menon', designation: 'QA/QC Lead', department: 'QA/QC', branch: 'Bengaluru HQ', dateOfJoining: '2023-08-01', email: 'qa@designtree.test', role: 'qaqc' },
  { key: 'bim', firstName: 'Nikhil', lastName: 'Joshi', designation: 'BIM Lead', department: 'BIM', branch: 'Bengaluru HQ', dateOfJoining: '2024-01-05', email: 'bim@designtree.test', role: 'bim' },
  { key: 'client', firstName: 'Suresh', lastName: 'Babu', designation: 'Client PM', department: 'Client', branch: 'Bengaluru HQ', dateOfJoining: '2024-01-05', email: 'client@designtree.test', role: 'client' },
  { key: 'arch', firstName: 'Asha', lastName: 'Verma', designation: 'Architect', department: 'Architect', branch: 'Bengaluru HQ', dateOfJoining: '2024-01-05', email: 'arch@designtree.test', role: 'architect' },
];

export const byKey = (key: string): CastMember => {
  const found = CAST.find((c) => c.key === key);
  if (!found) throw new Error(`Unknown cast key: ${key}`);
  return found;
};
