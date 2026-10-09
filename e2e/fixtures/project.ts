/**
 * Project DT-2601 payload (§2.2-§2.6).
 * UI path (NewProjectPage) sends plain-text contacts as { company } and
 * related/principalTeamLeads as typed; API path mirrors buildPayload().
 */

export const PROJECT = {
  name: 'Sunrise Heights Tower A',
  code: 'DT-2601',
  state: 'Karnataka',
  projectType: 'Residential',
  branch: 'Bengaluru HQ',
  usedFor: 'Residential Apartments',
  entityName: 'DesignTree Consultants Pvt Ltd',
  location: {
    label: 'Survey No 45, Whitefield, Bengaluru',
    city: 'Bengaluru',
    zip: '560066',
  },
  jobNumber: 'JOB-2601',
  scope: [
    { service: 'Structural', scope: 'RCC framed structure design', fee: 1200000 },
    { service: 'Mechanical', scope: 'HVAC design', fee: 600000 },
    { service: 'Electrical', scope: 'Electrical and ELV design', fee: 550000 },
    { service: 'Plumbing', scope: 'PHE design', fee: 350000 },
    { service: 'Fire', scope: 'Fire fighting design', fee: 300000 },
  ],
  related: {
    projectDirector: 'Founding Director',
    projectDirectorDesignation: 'Founding Director',
    projectHead: 'Divya Nair',
    projectHeadDesignation: 'Design Management Head',
  },
  principalTeamLeads: [
    { service: 'Structural', name: 'Arjun Reddy' },
    { service: 'Mechanical', name: 'Meera Shetty' },
  ],
  // UI form takes plain text; API takes contact objects.
  contactsText: {
    client: 'Lakeside Developers',
    architect: 'Studio AV',
    pmc: 'pmc@shreya.test',
  },
  billing: {
    name: 'Suresh Babu',
    company: 'Lakeside Developers',
    email: 'client@designtree.test',
    phone: '+91-98450-00001',
  },
} as const;

export const SPOC_SERVICES = ['Structural', 'Mechanical', 'Electrical', 'Plumbing', 'Fire'] as const;

export const MEETING_WEEK1 = {
  title: 'Weekly DRM review, Week 1',
  type: 'Client / DRM',
  startTime: '11:00',
  endTime: '12:00',
  mode: 'Online',
  link: 'https://meet.example.com/drm-wk1',
  conductedBy: 'Client',
  external: 'Suresh Babu (Client PM)',
  agenda: 'Kickoff DRM: scope freeze, drawing list sign-off',
} as const;

export const MEETING_SUDDEN = {
  title: 'Shaft S3 clash resolution',
  reason: 'Duct vs beam clash reported on site',
} as const;

export const MOM = {
  discussion: 'Shaft sizes frozen at 150 mm',
  decisions: 'Issue revised shaft section',
  followUp: 'Architect to confirm shaft closure',
} as const;

export const ACTIONS = [
  { text: 'Issue revised shaft section', ownerName: 'Karthik Nair', priority: 'High' },
  { text: 'Update electrical load sheet', ownerName: 'Meera Shetty', priority: 'Medium' },
] as const;

export const COORDINATION = {
  channel: 'Site',
  service: 'Mechanical',
  topic: 'Shaft S3 clash',
} as const;

export const RFI = {
  type: 'Technical',
  description: 'Confirm UPS load figures for load sheet',
  team: 'Structural',
} as const;

export const REVISION = {
  service: 'Structural',
  stage: 'DD',
  reason: 'Beam depth capped at 750 mm',
} as const;

export const BILLING = { stage: 'GFC', amount: 500000 } as const;
export const LEAVE = { type: 'Casual Leave', reason: 'Family function' } as const;
export const SUPPORT_QUERY = { subject: 'Payslip correction', details: 'Payslip for last month shows incorrect HRA.' } as const;
