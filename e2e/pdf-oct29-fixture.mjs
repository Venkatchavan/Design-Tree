import { startPdfFixture as startPreviousFixture } from './pdf-oct28-fixture.mjs';
export async function startPdfFixture(port = 0) {
  const f = await startPreviousFixture(port);
  try {
    await f.models.Employee.findByIdAndUpdate(f.cast.tl.employee, { director: f.cast.atd.employee });
    await f.models.Employee.findByIdAndUpdate(f.cast.engineer.employee, { reportingManager: f.cast.tl.employee });
    await f.models.Team.create({ name: 'Electrical team on shared project', service: 'ELE', projects: [f.project], lead: f.cast.outsider.employee, members: [{ employee: f.cast.outsider.employee }] });
    await f.models.Project.findByIdAndUpdate(f.project, { jobNumber: 'JOB-OCT29' });
    return f;
  } catch (error) { await f.stop(); throw error; }
}
