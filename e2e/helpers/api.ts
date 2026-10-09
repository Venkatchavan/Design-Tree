import { APIRequestContext, expect } from '@playwright/test';

/**
 * API helpers (cookie-JWT auth, §4 F-01 workaround).
 * All calls use Playwright's request context so cookies persist per context.
 */

export const apiUrl = () =>
  process.env.E2E_API_URL ?? 'http://localhost:5000';

export async function apiLogin(
  request: APIRequestContext,
  email: string,
  password: string,
) {
  const res = await request.post(`${apiUrl()}/api/auth/login`, {
    data: { email: email.toLowerCase().trim(), password },
  });
  expect(res.ok(), `login failed for ${email}: ${await res.text()}`).toBeTruthy();
  return res;
}

export async function apiLogout(request: APIRequestContext) {
  await request.post(`${apiUrl()}/api/auth/logout`, { data: {} });
}

export async function ensureProjectViaApi(
  request: APIRequestContext,
  payload: Record<string, unknown>,
): Promise<{ id: string; code: string }> {
  // Idempotent: reuse existing DT-2601 if present.
  const list = await request.get(
    `${apiUrl()}/api/projects?search=${encodeURIComponent('DT-2601')}`,
  );
  if (list.ok()) {
    const body = await list.json();
    const items: Array<{ _id: string; code: string }> =
      body.projects ?? body.items ?? body ?? [];
    const found = items.find((p) => p.code === 'DT-2601');
    if (found) return { id: found._id, code: found.code };
  }
  const created = await request.post(`${apiUrl()}/api/projects`, {
    data: payload,
  });
  expect(created.ok(), `project create failed: ${await created.text()}`).toBeTruthy();
  const body = await created.json();
  const project = body.project ?? body;
  return { id: project._id, code: project.code };
}

export async function ensureTeamsViaApi(
  request: APIRequestContext,
  projectId: string,
  employeeIds: { arjun: string; karthik: string; meera: string; ananya: string },
) {
  const defs = [
    {
      name: 'Structural Design',
      service: 'Structural',
      branch: 'Bengaluru HQ',
      lead: employeeIds.arjun,
      projects: [projectId],
      members: [{ employee: employeeIds.arjun }, { employee: employeeIds.karthik }],
    },
    {
      name: 'Mechanical Design',
      service: 'Mechanical',
      branch: 'Bengaluru HQ',
      lead: employeeIds.meera,
      projects: [projectId],
      members: [{ employee: employeeIds.meera }],
    },
    {
      name: 'MEP Coordination',
      service: 'MEP Coordination',
      branch: 'Bengaluru HQ',
      lead: employeeIds.ananya,
      projects: [projectId],
      members: [{ employee: employeeIds.ananya }, { employee: employeeIds.meera }],
    },
  ];
  for (const def of defs) {
    const existing = await request.get(
      `${apiUrl()}/api/teams?service=${encodeURIComponent(def.service)}`,
    );
    let found = false;
    if (existing.ok()) {
      const body = await existing.json();
      const items = body.teams ?? body.items ?? body ?? [];
      found = (items as Array<{ name: string }>).some((t) => t.name === def.name);
    }
    if (!found) {
      const res = await request.post(`${apiUrl()}/api/teams`, { data: def });
      expect(res.ok(), `team create ${def.name} failed: ${await res.text()}`).toBeTruthy();
    }
  }
}

export async function getEmployeeIdMap(
  request: APIRequestContext,
): Promise<Record<string, string>> {
  const res = await request.get(`${apiUrl()}/api/employees?search=${encodeURIComponent('designtree.test')}`);
  expect(res.ok(), `employees list failed: ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  const items: Array<{ _id: string; firstName: string; lastName: string }> =
    body.employees ?? body.items ?? body ?? [];
  const byName = (fn: string, ln: string) =>
    items.find((e) => e.firstName === fn && e.lastName === ln)?._id ?? '';
  return {
    arjun: byName('Arjun', 'Reddy'),
    karthik: byName('Karthik', 'Nair'),
    meera: byName('Meera', 'Shetty'),
    ananya: byName('Ananya', 'Rao'),
  };
}

export async function recordSpocAllocation(
  request: APIRequestContext,
  projectId: string,
  coordinatorEmployeeId: string,
  services: string[],
) {
  const res = await request.post(`${apiUrl()}/api/spoc/allocations`, {
    data: { project: projectId, coordinator: coordinatorEmployeeId, services },
  });
  // Upsert: 200/201 both pass.
  expect(res.ok(), `SPOC allocation failed: ${await res.text()}`).toBeTruthy();
  return res.json();
}
