import mongoose from 'mongoose';

// SPOC-owned project directory (§4.22): one document per project with the
// ten canonical sections. First read auto-seeds sections from the Project
// record; SPOC edits persist via PUT /api/projects/:id/directory.
export const DIRECTORY_KEYS = [
  'project-information',
  'client-details',
  'architect-details',
  'pmc-details',
  'work-order',
  'bim-work-order',
  'project-team',
  'scope-services',
  'project-documents',
  'communication-records',
];

const sectionSchema = new mongoose.Schema(
  {
    key: { type: String, enum: DIRECTORY_KEYS, required: true },
    title: { type: String, trim: true },
    body: { type: String, trim: true },
    _id: false,
  },
);

const projectDirectorySchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      unique: true,
      index: true,
    },
    sections: [sectionSchema],
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const ProjectDirectory =
  mongoose.models.ProjectDirectory ??
  mongoose.model('ProjectDirectory', projectDirectorySchema);

// Seed section bodies from the Project record. Derived sections stay in
// sync on every read unless the SPOC has overridden that section.
export function seedSectionsFromProject(project, existing = []) {
  const overridden = new Map(
    (existing ?? []).map((s) => [s.key, s]),
  );
  const pick = (key, title, body) => {
    if (overridden.has(key)) return overridden.get(key);
    return { key, title, body: body ?? '' };
  };
  const contactLine = (c) =>
    [c?.name, c?.designation, c?.company, c?.phone, c?.email]
      .filter(Boolean)
      .join(' · ');
  const scopeLines = (project.scope ?? [])
    .map((s) => `${s.service ?? ''}: ${s.scope ?? ''} (Rs ${s.fee ?? 0})`)
    .join('\n');
  return [
    pick(
      'project-information',
      'Project Information',
      `${project.name ?? ''} (${project.code ?? ''})\n${project.location?.label ?? ''} ${project.location?.city ?? ''}\n${project.description ?? ''}`,
    ),
    pick(
      'client-details',
      'Client Details',
      contactLine(project.contacts?.client) || project.clientName || '',
    ),
    pick('architect-details', 'Architect Details', contactLine(project.contacts?.architect)),
    pick('pmc-details', 'PMC Details', contactLine(project.contacts?.pmc)),
    pick(
      'work-order',
      'Work Order',
      `Job ${project.jobNumber ?? ''}\nQuoted fee Rs ${project.quotedFee ?? ''}\n${scopeLines}`,
    ),
    pick(
      'bim-work-order',
      'BIM Work Order',
      `${project.bimWorkOrder?.scope ?? ''}\nFee Rs ${project.bimWorkOrder?.fee ?? ''}\n${project.bimWorkOrder?.description ?? ''}`,
    ),
    pick(
      'project-team',
      'Project Team',
      `Director: ${project.related?.projectDirector ?? ''}\nHead: ${project.related?.projectHead ?? ''}\n${(project.principalTeamLeads ?? []).map((t) => `${t.service ?? ''} — ${t.name ?? ''}`).join('\n')}`,
    ),
    pick('scope-services', 'Scope & Services', scopeLines),
    pick('project-documents', 'Project Documents', overridden.get('project-documents')?.body ?? ''),
    pick('communication-records', 'Communication Records', overridden.get('communication-records')?.body ?? ''),
  ];
}
