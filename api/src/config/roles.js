// Canonical Datum role + view registry.
// Source: functional doc §3.1 (26 roles), Appendix A (navigation by role),
// §3.3 (access rules), §3.4 (FD/WD full access). Served to the client via
// GET /api/meta/bootstrap so there is exactly one copy of this config.

export const SUPER_ROLES = ['founding_director', 'working_director'];

export const ROLES = [
  { key: 'founding_director', label: 'Founding Director', designation: 'Founding Director', home: 'dashboard' },
  { key: 'working_director', label: 'Working Director', designation: 'Working Director', home: 'dashboard' },
  { key: 'admin_billing', label: 'Admin / Billing', designation: 'Administrator, Admin / Billing', home: 'dashboard' },
  { key: 'hr', label: 'HR', designation: 'HR lead', home: 'hr' },
  { key: 'executive_director', label: 'Executive Director', designation: 'Executive Director', home: 'dashboard' },
  { key: 'associate_director', label: 'Associate Director', designation: 'Associate Director', home: 'dashboard' },
  { key: 'technical_director', label: 'Technical Director', designation: 'Technical Director', home: 'dashboard' },
  { key: 'assoc_technical_director', label: 'Associate Technical Director', designation: 'Associate Technical Director', home: 'my-team' },
  { key: 'team_lead', label: 'Team Lead (TL)', designation: 'Team Lead, Structural', home: 'my-team' },
  { key: 'coordinator', label: 'Coordinator (SPOC)', designation: 'Coordinator (SPOC)', home: 'my-coordination' },
  { key: 'engineer_drafter', label: 'Engineer / Drafter', designation: 'Junior designer, Structural', home: 'my-work' },
  { key: 'qs', label: 'QS', designation: 'QS Lead', home: 'work-tracking' },
  { key: 'qaqc', label: 'QA/QC', designation: 'QA/QC Lead', home: 'work-tracking' },
  { key: 'bim', label: 'BIM', designation: 'BIM Lead', home: 'work-tracking' },
  { key: 'gbs', label: 'GBS', designation: 'GBS Lead', home: 'work-tracking' },
  { key: 'marketing', label: 'Marketing', designation: 'Marketing Lead', home: 'marketing' },
  { key: 'design_mgmt_head', label: 'Design Management Head', designation: 'Design Management Head', home: 'design-mgmt' },
  { key: 'finance', label: 'Finance', designation: 'Finance Head', home: 'finance' },
  { key: 'qaqc_head', label: 'QA/QC Specifications Head', designation: 'QA/QC Specifications Head', home: 'qaqc-specs' },
  { key: 'bim_head', label: 'BIM Head', designation: 'BIM Head', home: 'bim-head' },
  { key: 'gbs_head', label: 'GBS Head', designation: 'GBS Head', home: 'gbs-head' },
  { key: 'peer_review_head', label: 'Peer Review Head', designation: 'Peer Review Head', home: 'peer-review-head' },
  { key: 'qs_head', label: 'QS Head', designation: 'QS Head', home: 'qs-head' },
  { key: 'peer_reviewer', label: 'Peer Review', designation: 'Peer Reviewer, Mechanical', home: 'work-tracking' },
  { key: 'client', label: 'Client', designation: 'Client', home: 'project-portal' },
  { key: 'architect', label: 'Architect', designation: 'Architect of record', home: 'project-portal' },
];

export const ROLE_KEYS = ROLES.map((r) => r.key);

export function isSuperRole(role) {
  return SUPER_ROLES.includes(role);
}

// Every view: route path, display title, subtitle, build phase.
// `guard` further restricts beyond nav membership where needed.
export const VIEWS = {
  'dashboard': { path: '/dashboard', label: 'Dashboard', sub: 'Company project dashboard', phase: 1 },
  'project-detail': { path: '/projects/:id', label: 'Project Detail', sub: 'Design-stage timeline against plan', phase: 1, via: 'dashboard' },
  'new-project': { path: '/projects/new', label: 'New Project', sub: 'These fields become the basis for every filter downstream', phase: 1, via: 'dashboard' },
  'billing': { path: '/billing', label: 'Billing', sub: 'Company-wide claims and collections across all branches', phase: 3 },
  'certificates': { path: '/certificates', label: 'Completion Certificates', sub: 'Issued certificates, templates and client requests', phase: 3 },
  'teams': { path: '/teams', label: 'Teams', sub: 'Team rosters and weekly time approval', phase: 1 },
  'team-detail': { path: '/teams/:id', label: 'Team', sub: 'Team roster and weekly activity', phase: 1, via: 'teams' },
  'hr': { path: '/hr', label: 'HR', sub: 'Employee records and workforce administration', phase: 1 },
  'work-progress': { path: '/work-progress', label: 'Work Progress', sub: 'Organisation-wide daily activity', phase: 2 },
  'transmittal-log': { path: '/transmittals', label: 'Transmittal Log', sub: 'Company transmittal register', phase: 3 },
  'transmittal': { path: '/admin/transmittals', label: 'Transmittal', sub: 'Admin · create and manage transmittals from TL drawing lists', phase: 3, adminOnly: true },
  'design-mgmt': { path: '/design-management', label: 'Design Management', sub: 'Coordination, deliverables and RFI tracking', phase: 4 },
  'marketing': { path: '/marketing', label: 'Marketing Dashboard', sub: 'Portfolio, collateral requests and contacts', phase: 4 },
  'finance': { path: '/finance', label: 'Finance Dashboard', sub: 'Revenue, billing, cost and travel snapshot', phase: 3 },
  'finance-occ': { path: '/finance/occ', label: 'Finance Operation Control Center (OCC)', sub: 'DT Finance Operations Control Centre', phase: 3 },
  'travel-booking': { path: '/finance/travel', label: 'Travel Booking', sub: 'Travel and hotel bookings', phase: 3 },
  'revenue-reports': { path: '/finance/revenue', label: 'Revenue & Financial Reports', sub: 'Service-wise and project-wise financial view', phase: 3 },
  'billing-status': { path: '/finance/billing-status', label: 'Billing Status', sub: 'Live billing readiness by stage', phase: 3 },
  'qaqc-specs': { path: '/qaqc', label: 'QA/QC Specifications', sub: 'QA/QC overview and approvals', phase: 4 },
  'bim-head': { path: '/bim', label: 'BIM', sub: 'BIM overview and approvals', phase: 4 },
  'gbs-head': { path: '/gbs', label: 'GBS', sub: 'Green-building overview and approvals', phase: 4 },
  'peer-review-head': { path: '/peer-review', label: 'Peer Review', sub: 'Peer review overview and approvals', phase: 4 },
  'qs-head': { path: '/qs', label: 'QS / BOQ', sub: 'QS overview and approvals', phase: 4 },
  'structural': { path: '/departments/structural', label: 'Structural', sub: 'Company-wide Structural dashboard', phase: 4, boardOnly: true },
  'mechanical': { path: '/departments/mechanical', label: 'Mechanical', sub: 'Company-wide Mechanical dashboard', phase: 4, boardOnly: true },
  'electrical': { path: '/departments/electrical', label: 'Electrical', sub: 'Company-wide Electrical dashboard', phase: 4, boardOnly: true },
  'phe': { path: '/departments/phe', label: 'PHE', sub: 'Company-wide PHE dashboard', phase: 4, boardOnly: true },
  'fire': { path: '/departments/fire', label: 'Fire', sub: 'Company-wide Fire dashboard', phase: 4, boardOnly: true },
  'project-portal': { path: '/portal', label: 'Project Portal', sub: 'External client / architect portal', phase: 4, externalOnly: true },
  'update-work-progress': { path: '/work/update', label: 'Update Work Progress', sub: 'Hours worked, work done and the daily entry', phase: 2 },
  'leave-travel': { path: '/leave-travel', label: 'Leave & Travel', sub: 'Leave, travel and allowance requests', phase: 4 },
  'employee-support': { path: '/support', label: 'Employee support', sub: 'Salary slips, complaints, suggestions, queries', phase: 4, noFinance: true },
  'management': { path: '/management', label: 'Management & Leadership Dashboard', sub: 'Consolidated delivery, commercial and people overview', phase: 4 },
  'my-team': { path: '/my-team', label: 'My team', sub: 'My projects and team', phase: 2 },
  'my-coordination': { path: '/my-coordination', label: 'My coordination', sub: 'Coordinator (SPOC) workspace', phase: 2 },
  'my-work': { path: '/my-work', label: 'My work', sub: 'Engineer / Drafter workspace', phase: 2 },
  'work-tracking': { path: '/work-tracking', label: 'Work tracking', sub: 'Service work tracking', phase: 2 },
  'settings': { path: '/settings', label: 'Settings', sub: 'Placeholder — no screen behind it yet', phase: 4 },
  'org-structure': { path: '/org', label: 'Org Structure & Policy', sub: 'Reporting hierarchy and level & approval policy', phase: 4 },
};

const BOARD_ROLES = [
  'founding_director',
  'working_director',
  'executive_director',
  'associate_director',
  'technical_director',
];

// Navigation per role, in Appendix A order. Entries may relabel a view.
const FULL_LEADERSHIP_NAV = [
  { view: 'dashboard', label: 'Dashboard' },
  { view: 'dashboard', label: 'Projects' },
  { view: 'billing' },
  { view: 'certificates' },
  { view: 'teams' },
  { view: 'hr' },
  { view: 'work-progress' },
  { view: 'transmittal-log' },
  { view: 'design-mgmt' },
  { view: 'marketing' },
  { view: 'finance' },
  { view: 'finance-occ' },
  { view: 'travel-booking' },
  { view: 'revenue-reports' },
  { view: 'billing-status' },
  { view: 'qaqc-specs' },
  { view: 'bim-head' },
  { view: 'gbs-head' },
  { view: 'peer-review-head' },
  { view: 'qs-head' },
  { view: 'structural' },
  { view: 'mechanical' },
  { view: 'electrical' },
  { view: 'phe' },
  { view: 'fire' },
  { view: 'update-work-progress' },
  { view: 'leave-travel' },
  { view: 'employee-support' },
  { view: 'management' },
];

export const NAV_BY_ROLE = {
  founding_director: FULL_LEADERSHIP_NAV,
  working_director: FULL_LEADERSHIP_NAV,
  executive_director: FULL_LEADERSHIP_NAV,
  associate_director: [
    { view: 'dashboard', label: 'Dashboard' },
    { view: 'dashboard', label: 'Projects' },
    { view: 'certificates' },
    { view: 'teams' },
    { view: 'work-progress' },
    { view: 'transmittal-log' },
    { view: 'design-mgmt' },
    { view: 'travel-booking' },
    { view: 'billing-status' },
    { view: 'qaqc-specs' },
    { view: 'bim-head' },
    { view: 'gbs-head' },
    { view: 'peer-review-head' },
    { view: 'qs-head' },
    { view: 'structural' },
    { view: 'mechanical' },
    { view: 'electrical' },
    { view: 'phe' },
    { view: 'fire' },
    { view: 'update-work-progress' },
    { view: 'leave-travel' },
    { view: 'employee-support' },
    { view: 'management' },
  ],
  technical_director: [
    { view: 'dashboard', label: 'Dashboard' },
    { view: 'dashboard', label: 'Projects' },
    { view: 'certificates' },
    { view: 'teams' },
    { view: 'work-progress' },
    { view: 'transmittal-log' },
    { view: 'design-mgmt' },
    { view: 'travel-booking' },
    { view: 'billing-status' },
    { view: 'qaqc-specs' },
    { view: 'bim-head' },
    { view: 'gbs-head' },
    { view: 'peer-review-head' },
    { view: 'qs-head' },
    { view: 'structural' },
    { view: 'mechanical' },
    { view: 'electrical' },
    { view: 'phe' },
    { view: 'fire' },
    { view: 'update-work-progress' },
    { view: 'leave-travel' },
    { view: 'employee-support' },
    { view: 'management' },
  ],
  assoc_technical_director: [
    { view: 'dashboard', label: 'Dashboard' },
    { view: 'dashboard', label: 'Projects' },
    { view: 'certificates' },
    { view: 'teams' },
    { view: 'work-progress' },
    { view: 'transmittal-log' },
    { view: 'design-mgmt' },
    { view: 'travel-booking' },
    { view: 'billing-status' },
    { view: 'qaqc-specs' },
    { view: 'bim-head', label: 'BIM Head' },
    { view: 'gbs-head', label: 'GBS Head' },
    { view: 'peer-review-head', label: 'Peer Review Head' },
    { view: 'qs-head', label: 'QS Head' },
    { view: 'update-work-progress' },
    { view: 'leave-travel' },
    { view: 'employee-support' },
    { view: 'my-team' },
  ],
  admin_billing: [
    { view: 'dashboard', label: 'Dashboard' },
    { view: 'dashboard', label: 'Projects' },
    { view: 'billing' },
    { view: 'certificates' },
    { view: 'teams' },
    { view: 'transmittal' },
    { view: 'update-work-progress' },
    { view: 'leave-travel' },
    { view: 'employee-support' },
  ],
  hr: [
    { view: 'dashboard', label: 'Dashboard' },
    { view: 'dashboard', label: 'Projects' },
    { view: 'certificates' },
    { view: 'teams' },
    { view: 'hr' },
    { view: 'transmittal-log' },
    { view: 'update-work-progress' },
    { view: 'leave-travel' },
    { view: 'employee-support' },
  ],
  team_lead: [
    { view: 'dashboard', label: 'Dashboard' },
    { view: 'dashboard', label: 'Projects' },
    { view: 'work-progress' },
    { view: 'transmittal-log' },
    { view: 'update-work-progress' },
    { view: 'leave-travel' },
    { view: 'employee-support' },
    { view: 'my-team' },
  ],
  coordinator: [
    { view: 'dashboard', label: 'Dashboard' },
    { view: 'dashboard', label: 'Projects' },
    { view: 'transmittal-log' },
    { view: 'leave-travel' },
    { view: 'employee-support' },
    { view: 'my-coordination' },
  ],
  engineer_drafter: [
    { view: 'transmittal-log' },
    { view: 'leave-travel' },
    { view: 'employee-support' },
    { view: 'my-work' },
  ],
  qs: [
    { view: 'update-work-progress' },
    { view: 'leave-travel' },
    { view: 'employee-support' },
    { view: 'work-tracking' },
  ],
  qaqc: [
    { view: 'dashboard', label: 'Dashboard' },
    { view: 'dashboard', label: 'Projects' },
    { view: 'transmittal-log' },
    { view: 'update-work-progress' },
    { view: 'leave-travel' },
    { view: 'employee-support' },
    { view: 'work-tracking' },
  ],
  bim: [
    { view: 'update-work-progress' },
    { view: 'leave-travel' },
    { view: 'employee-support' },
    { view: 'work-tracking' },
  ],
  gbs: [
    { view: 'update-work-progress' },
    { view: 'leave-travel' },
    { view: 'employee-support' },
    { view: 'work-tracking' },
  ],
  peer_reviewer: [
    { view: 'update-work-progress' },
    { view: 'leave-travel' },
    { view: 'employee-support' },
    { view: 'work-tracking' },
  ],
  marketing: [
    { view: 'marketing' },
    { view: 'update-work-progress' },
    { view: 'leave-travel' },
    { view: 'employee-support' },
  ],
  design_mgmt_head: [
    { view: 'dashboard', label: 'Dashboard' },
    { view: 'dashboard', label: 'Projects' },
    { view: 'design-mgmt' },
    { view: 'update-work-progress' },
    { view: 'leave-travel' },
    { view: 'employee-support' },
  ],
  finance: [
    { view: 'finance' },
    { view: 'finance-occ' },
    { view: 'travel-booking' },
    { view: 'revenue-reports' },
    { view: 'billing-status' },
    { view: 'update-work-progress' },
    { view: 'leave-travel' },
  ],
  qaqc_head: [
    { view: 'qaqc-specs' },
    { view: 'update-work-progress' },
    { view: 'leave-travel' },
    { view: 'employee-support' },
  ],
  bim_head: [
    { view: 'bim-head', label: 'BIM Head' },
    { view: 'update-work-progress' },
    { view: 'leave-travel' },
    { view: 'employee-support' },
  ],
  gbs_head: [
    { view: 'gbs-head', label: 'GBS Head' },
    { view: 'update-work-progress' },
    { view: 'leave-travel' },
    { view: 'employee-support' },
  ],
  peer_review_head: [
    { view: 'peer-review-head', label: 'Peer Review Head' },
    { view: 'update-work-progress' },
    { view: 'leave-travel' },
    { view: 'employee-support' },
  ],
  qs_head: [
    { view: 'qs-head', label: 'QS Head' },
    { view: 'update-work-progress' },
    { view: 'leave-travel' },
    { view: 'employee-support' },
  ],
  client: [{ view: 'project-portal' }],
  architect: [{ view: 'project-portal' }],
};

export function roleLabel(role) {
  return ROLES.find((r) => r.key === role)?.label ?? role;
}

export function homeView(role) {
  return ROLES.find((r) => r.key === role)?.home ?? 'dashboard';
}

// Nav with resolved labels/paths for a role.
// Org Structure & Policy (§4.20) is reachable by every internal role even
// though Appendix A omits it from the per-role lists.
export function navFor(role) {
  const items = [...(NAV_BY_ROLE[role] ?? [])];
  if (role !== 'client' && role !== 'architect') {
    items.push({ view: 'org-structure' });
  }
  return items.map((item) => {
    const def = VIEWS[item.view];
    return {
      view: item.view,
      label: item.label ?? def.label,
      path: def.path,
    };
  });
}

// Roles that may create/update user logins (FD/WD superusers always can).
export const USER_ADMIN_ROLES = ['hr', 'admin_billing'];

// All roles except external Client/Architect.
export const INTERNAL_ROLES = ROLE_KEYS.filter(
  (r) => r !== 'client' && r !== 'architect',
);

// Second-layer page guard (§2.7): nav membership + view flags + superuser.
export function canAccess(role, view) {
  if (!VIEWS[view]) return false;
  if (isSuperRole(role)) return true;
  // Admin can open the HR view (for user provisioning) even though it is
  // not in the Admin sidebar — §3.3 does not block Admin from HR.
  if (role === 'admin_billing' && view === 'hr') return true;
  const def = VIEWS[view];
  const inNav = (NAV_BY_ROLE[role] ?? []).some((i) => i.view === view);
  const viaNav =
    def.via != null &&
    (NAV_BY_ROLE[role] ?? []).some((i) => i.view === def.via);
  if (!inNav && !viaNav) return false;
  if (def.adminOnly && role !== 'admin_billing') return false;
  if (def.externalOnly && role !== 'client' && role !== 'architect')
    return false;
  if (def.boardOnly && !BOARD_ROLES.includes(role)) return false;
  if (def.noFinance && role === 'finance') return false;
  return true;
}
