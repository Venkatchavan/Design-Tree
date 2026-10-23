import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeesApi, projectsApi } from '../lib/api.js';
import { financeOccApi } from '../lib/phase3Api.js';

// Finance Operation Control Center (OCC) — exact interface ported from
// project-reference/Datum_dashboard_with_meetings.html (FIN_OCC_HTML sub-app),
// driven entirely by live /api/finance-occ records. No sample data.
// Visible to finance + FD/WD/ED via the /finance/hub entry (see roles.js);
// mutations stay gated on canDecide (finance / founding / working director).

const CATS = [
  ['tickets', 'Travel tickets'],
  ['hotel', 'Hotel bills'],
  ['food', 'Food bills'],
  ['local', 'Local conveyance'],
  ['cab', 'Cab bills'],
  ['other', 'Other supporting bills'],
];
const HOSP_MAP = {
  Accommodation: ['hotel'],
  Food: ['food'],
  'Local Transport': ['local', 'cab'],
  Other: ['other'],
};
const HOSP_TYPES = Object.keys(HOSP_MAP);
const PO_APPROVAL = ['Pending', 'In Review', 'Approved'];
const OCC_SETTLEMENTS = ['Not started', 'Pending', 'Settled'];
const CLAIM_STATUS = ['Pending', 'Raised', 'Closed'];
const PO_PAY = ['Pending', 'Paid'];
const APPR = ['Pending', 'In Review', 'Approved'];
const DEPTS = ['Structural', 'MEP', 'Plumbing & Fire', 'BIM', 'Admin'];
const AC_GROUPS = [
  ['all', 'All'], ['po', 'PO approval'], ['adv', 'Advance settlement'], ['hard', 'Hardcopy missing'],
  ['verify', 'Verification'], ['docs', 'Missing docs'], ['raise', 'To raise'], ['rappr', 'Awaiting approval'],
  ['rpay', 'Awaiting payment'], ['recover', 'Recovery'], ['payable', 'Payable'],
  ['rclose', 'Ready to close (claims)'],
];

// Legacy boolean checklist keys (travel/stay/food/local/misc) map onto CATS keys.
const LEGACY_CHECKS = { travel: 'tickets', stay: 'hotel', food: 'food', local: 'local', misc: 'other' };

const DAY_MS = 86400000;
void DAY_MS;
const idOf = (v) => {
  if (v && typeof v === 'object') return String(v._id ?? v.id ?? '');
  return String(v ?? '');
};
const inr = (v) => `₹${Math.round(Number(v ?? 0)).toLocaleString('en-IN')}`;
const inrShort = (v) => {
  const n = Number(v ?? 0);
  const a = Math.abs(n);
  if (a >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return inr(n);
};
const isoDay = (v) => String(v ?? '').slice(0, 10);
const fmtD = (v) => {
  const s = isoDay(v);
  if (!s) return '—';
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtDT = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const todayLine = () => new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

function empName(e) {
  if (!e) return '—';
  if (typeof e === 'string') return e;
  return `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || e.empId || e.email || '—';
}
function verifierName(v) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return [v.name, v.firstName, v.lastName].filter(Boolean).join(' ') || v.email || '';
}

// ---- view-model builders (backend record -> FIN_OCC record shape) ----
function checksOf(entry) {
  const raw = entry?.verification?.checks;
  const obj = raw instanceof Map ? Object.fromEntries(raw) : { ...(raw ?? {}) };
  const out = {};
  for (const [k, val] of Object.entries(obj)) {
    out[LEGACY_CHECKS[k] ?? k] = val === true;
  }
  return out;
}

function buildPO(e) {
  return {
    kind: 'po',
    id: String(e._id ?? e.id),
    poNo: e.poNo ?? '',
    project: e.project?.name ?? '',
    projectId: idOf(e.project),
    dept: e.dept ?? '',
    vendor: e.vendor ?? '',
    date: isoDay(e.createdAt),
    amount: Number(e.amount ?? 0),
    requestedBy: e.requestedBy ?? '',
    employeeId: idOf(e.employee),
    approval: e.approval ?? 'Pending',
    payment: e.payment ?? 'Pending',
    docs: e.docs ?? [],
    remarks: e.remarks ?? '',
    history: (e.history ?? []).map((h) => ({ t: h.at, by: h.by, a: h.action })),
    raw: e,
  };
}

function buildTravel(e, empById) {
  const emp = typeof e.employee === 'object' ? e.employee : empById.get(idOf(e.employee));
  const checks = checksOf(e);
  const v = {
    ...checks,
    original: checks.original === true,
    match: checks.match === true,
    by: verifierName(e.verification?.verifiedBy),
    date: isoDay(e.verification?.verifiedAt),
    missing: e.verification?.missing ?? '',
  };
  return {
    kind: 'travel',
    id: String(e._id ?? e.id),
    empName: empName(emp ?? e.employee),
    empId: (emp && typeof emp === 'object' ? emp.empId : '') ?? '',
    employeeId: idOf(e.employee),
    project: e.project?.name ?? '',
    projectId: idOf(e.project),
    dept: (emp && typeof emp === 'object' ? emp.department : '') ?? '',
    client: e.client ?? '',
    purpose: e.purpose ?? '',
    location: e.location ?? '',
    from: isoDay(e.fromDate),
    to: isoDay(e.toDate),
    advance: e.advanceReceived ?? Number(e.amount ?? 0),
    advDate: isoDay(e.advanceDate) || isoDay(e.createdAt),
    exp: {
      tickets: Number(e.fare ?? 0),
      hotel: Number(e.lodgingAmount ?? 0),
      food: Number(e.foodPerDiem ?? 0),
      local: Number(e.localConveyance ?? 0),
      cab: Number(e.cabBills ?? 0),
      other: Number(e.misc ?? 0),
    },
    billsSubmitted: e.billsSubmitted ? 'Yes' : 'No',
    hardcopy: e.hardcopyReceived ? 'Yes' : 'No',
    v,
    settlement: e.settlement ?? 'Not started',
    status: e.status ?? 'Pending',
    remarks: e.remarks ?? '',
    docs: e.docs ?? [],
    history: (e.history ?? []).map((h) => ({ t: h.at, by: h.by, a: h.action })),
    raw: e,
  };
}

function buildReimb(e, advances) {
  const emp = e.employee;
  const linked = advances.find((t) => t.id === idOf(e.linkedTravel));
  return {
    kind: 'reimb',
    id: String(e._id ?? e.id),
    empName: empName(emp),
    employeeId: idOf(e.employee),
    project: e.project?.name ?? linked?.project ?? '',
    projectId: idOf(e.project) || linked?.projectId || '',
    dept: (emp && typeof emp === 'object' ? emp.department : '') ?? linked?.dept ?? '',
    client: e.client ?? '',
    from: isoDay(e.fromDate) || linked?.from || isoDay(e.createdAt),
    to: isoDay(e.toDate) || linked?.to || isoDay(e.createdAt),
    hosp: e.hosp ?? '',
    types: e.hospTypes ?? [],
    amount: Number(e.amount ?? 0),
    docs: e.docs ?? [],
    status: e.status ?? 'Pending',
    raisedDate: isoDay(e.raisedDate),
    refNo: e.refNo ?? '',
    approval: e.approval ?? 'Pending',
    payment: e.payment ?? 'Pending',
    travelId: idOf(e.linkedTravel),
    remarks: e.remarks ?? '',
    history: (e.history ?? []).map((h) => ({ t: h.at, by: h.by, a: h.action })),
    raw: e,
  };
}

// ---- derived logic (mirrors the FIN_OCC reference) ----
function coveredCats(t, claims) {
  const set = new Set();
  for (const r of claims) {
    if (r.travelId && r.travelId === t.id && r.hosp === 'Yes') {
      for (const ty of r.types) for (const k of HOSP_MAP[ty] ?? []) set.add(k);
    }
  }
  return set;
}
function travelCalc(t, claims) {
  const cov = coveredCats(t, claims);
  const exp = t.exp ?? {};
  let claimed = 0; let eligible = 0; let excluded = 0;
  const exList = [];
  for (const [k, label] of CATS) {
    const val = Number(exp[k] ?? 0);
    claimed += val;
    if (cov.has(k)) {
      excluded += val;
      if (val > 0) exList.push(`${label} ${inr(val)}`);
    } else eligible += val;
  }
  return { claimed, eligible, excluded, exList, balance: Number(t.advance ?? 0) - eligible };
}
function verifState(t) {
  const v = t.v ?? {};
  const exp = t.exp ?? {};
  const need = CATS.filter(([k]) => Number(exp[k] ?? 0) > 0).map(([k]) => k);
  const checks = need.map((k) => !!v[k]);
  const items = [...checks, t.hardcopy === 'Yes', v.original === true, v.match === true, !!v.by, !!v.date];
  const done = items.filter(Boolean).length;
  const complete = t.billsSubmitted === 'Yes' && need.length > 0 && done === items.length;
  const touched = checks.some(Boolean) || v.original || v.match;
  const status = complete ? 'Verified' : touched ? 'In Review' : 'Pending';
  const missing = [];
  if (t.billsSubmitted !== 'Yes') missing.push('bills not submitted');
  if (t.hardcopy !== 'Yes') missing.push('hardcopy not received');
  need.forEach((k) => { if (!v[k]) missing.push(`${CATS.find((c) => c[0] === k)[1].toLowerCase()} unchecked`); });
  if (v.original !== true) missing.push('original not confirmed');
  if (v.match !== true) missing.push('amount match not confirmed');
  if (!v.by || !v.date) missing.push('verifier/date blank');
  return { status, complete, done, total: items.length, need, missing };
}
const settled = (t) => t.settlement === 'Settled';

const LEGACY_KEY = 'datum-finance-occ-v1';
function readLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    const n = (p.advances?.length ?? 0) + (p.claims?.length ?? 0) + (p.pos?.length ?? 0);
    return n > 0 ? p : null;
  } catch {
    return null;
  }
}

export default function FinanceOccPage({ bootstrap }) {
  const role = bootstrap?.role?.key ?? '';
  const canDecide = role === 'finance';
  const qc = useQueryClient();

  const [tab, setTab] = useState('overview');
  const [acFilter, setAcFilter] = useState('all');
  const [drawer, setDrawer] = useState(null); // { view:'po'|'travel'|'verify'|'reimb', mode:'create'|'edit', id? }
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const [legacy, setLegacy] = useState(readLegacy);

  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const [fEmp, setFEmp] = useState('');
  const [fProj, setFProj] = useState('');
  const [fDept, setFDept] = useState('');
  const [fClient, setFClient] = useState('');
  const [fVendor, setFVendor] = useState('');
  const [fPO, setFPO] = useState('');
  const [fTS, setFTS] = useState('');
  const [fRS, setFRS] = useState('');
  const [fPay, setFPay] = useState('');

  const allQ = useQuery({ queryKey: ['finance-occ-all'], queryFn: () => financeOccApi.list({}) });
  const employeesQ = useQuery({ queryKey: ['employees-pick'], queryFn: () => employeesApi.list({}) });
  const projectsQ = useQuery({ queryKey: ['projects-pick'], queryFn: () => projectsApi.list({}) });

  const employees = useMemo(() => employeesQ.data?.items ?? [], [employeesQ.data]);
  const projects = useMemo(() => projectsQ.data?.items ?? [], [projectsQ.data]);
  const rawAll = useMemo(() => allQ.data?.items ?? [], [allQ.data]);

  const empById = useMemo(() => {
    const m = new Map();
    for (const e of employees) m.set(String(e._id ?? e.id), e);
    return m;
  }, [employees]);

  const pos = useMemo(() => rawAll.filter((e) => e.kind === 'po').map(buildPO), [rawAll]);
  const travel = useMemo(() => rawAll.filter((e) => e.kind === 'advance').map((e) => buildTravel(e, empById)), [rawAll, empById]);
  const reimb = useMemo(() => {
    const advs = rawAll.filter((e) => e.kind === 'advance').map((e) => buildTravel(e, empById));
    return rawAll.filter((e) => e.kind === 'claim').map((e) => buildReimb(e, advs));
  }, [rawAll, empById]);

  const notify = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  };
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['finance-occ-all'] });
    qc.invalidateQueries({ queryKey: ['finance-occ-summary'] });
  };

  const createM = useMutation({
    mutationFn: financeOccApi.create,
    onSuccess: () => invalidate(),
    onError: (e) => notify(e.message),
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }) => financeOccApi.update(id, body),
    onSuccess: () => invalidate(),
    onError: (e) => notify(e.message),
  });
  const decideM = useMutation({
    mutationFn: ({ id, body }) => financeOccApi.decide(id, body),
    onSuccess: () => invalidate(),
    onError: (e) => notify(e.message),
  });
  const removeM = useMutation({
    mutationFn: financeOccApi.remove,
    onSuccess: () => { invalidate(); setDrawer(null); notify('Entry deleted.'); },
    onError: (e) => notify(e.message),
  });

  async function saveCreate(kind, body, files) {
    const created = await createM.mutateAsync(body);
    const id = created?.item?._id ?? created?.item?.id ?? created?._id;
    if (files?.length && id) {
      try {
        await financeOccApi.uploadDocs(id, files);
      } catch (e) {
        notify(e.message);
      }
    }
    invalidate();
    setDrawer(null);
    notify('Saved.');
  }
  async function saveUpdate(id, body, files) {
    await updateM.mutateAsync({ id, body });
    if (files?.length) {
      try {
        await financeOccApi.uploadDocs(id, files);
      } catch (e) {
        notify(e.message);
      }
    }
    invalidate();
    setDrawer(null);
    notify('Saved.');
  }
  async function runDecide(id, body, okMsg) {
    await decideM.mutateAsync({ id, body });
    invalidate();
    setDrawer(null);
    notify(okMsg ?? 'Saved.');
  }
  async function raiseReimb(r) {
    const refNo = r.refNo || nextRefNo(reimb);
    await updateM.mutateAsync({
      id: r.id,
      body: {
        status: 'Raised',
        raisedDate: r.raisedDate || todayISO(),
        refNo,
        ...(r.approval === 'Pending' ? { approval: 'In Review' } : {}),
      },
    });
    invalidate();
    notify(`Reimbursement raised · ${refNo} · ${inr(r.amount)}`);
  }
  async function closeReimb(r) {
    await runDecide(r.id, { status: 'Closed' }, 'Claim closed after payment.');
  }
  async function closeTravel(t) {
    const vs = verifState(t);
    if (!vs.complete) {
      notify('Complete the hardcopy verification before closing.');
      setDrawer({ view: 'verify', mode: 'edit', id: t.id });
      return;
    }
    const c = travelCalc(t, reimb);
    const note = c.balance > 0 ? `Closed · ${inr(c.balance)} recovered from employee`
      : c.balance < 0 ? `Closed · ${inr(-c.balance)} paid to employee` : 'Closed · nil balance';
    await runDecide(t.id, { settlement: 'Settled' }, note);
  }

  // ---- filtering (mirrors the reference) ----
  const V = useMemo(() => {
    const inRange = (d) => {
      if (!d) return !(fFrom || fTo);
      if (fFrom && d < fFrom) return false;
      if (fTo && d > fTo) return false;
      return true;
    };
    const p = pos.filter((x) => {
      if (!inRange(isoDay(x.raw.createdAt))) return false;
      if (fEmp && x.requestedBy !== fEmp && empName(x.raw.employee) !== fEmp) return false;
      if (fProj && x.project !== fProj) return false;
      if (fDept && x.dept !== fDept) return false;
      if (fClient) return false;
      if (fVendor && x.vendor !== fVendor) return false;
      if (fPO && x.approval !== fPO) return false;
      if (fPay && x.payment !== fPay) return false;
      if (fTS || fRS) return false;
      return true;
    }).sort((a, b) => String(b.raw.createdAt ?? '').localeCompare(String(a.raw.createdAt ?? '')));
    const t = travel.filter((x) => {
      if (!inRange(x.from || isoDay(x.raw.createdAt))) return false;
      if (fEmp && x.empName !== fEmp) return false;
      if (fProj && x.project !== fProj) return false;
      if (fDept && x.dept !== fDept) return false;
      if (fClient && x.client !== fClient) return false;
      if (fVendor || fPO || fRS || fPay) return false;
      if (fTS && x.settlement !== fTS) return false;
      return true;
    }).sort((a, b) => String(b.from || '').localeCompare(String(a.from || '')));
    const r = reimb.filter((x) => {
      if (!inRange(x.from || isoDay(x.raw.createdAt))) return false;
      if (fEmp && x.empName !== fEmp) return false;
      if (fProj && x.project !== fProj) return false;
      if (fDept && x.dept !== fDept) return false;
      if (fClient && x.client !== fClient) return false;
      if (fVendor || fPO || fTS) return false;
      if (fRS && x.status !== fRS) return false;
      if (fPay && x.payment !== fPay) return false;
      return true;
    }).sort((a, b) => String(b.from || '').localeCompare(String(a.from || '')));
    return { pos: p, travel: t, reimb: r };
  }, [pos, travel, reimb, fFrom, fTo, fEmp, fProj, fDept, fClient, fVendor, fPO, fTS, fRS, fPay]);

  const activeFilters = [fFrom, fTo, fEmp, fProj, fDept, fClient, fVendor, fPO, fTS, fRS, fPay].filter(Boolean).length;
  const clearFilters = () => {
    setFFrom(''); setFTo(''); setFEmp(''); setFProj(''); setFDept('');
    setFClient(''); setFVendor(''); setFPO(''); setFTS(''); setFRS(''); setFPay('');
  };

  const empOpts = useMemo(() => [...new Set([...travel.map((t) => t.empName), ...reimb.map((r) => r.empName), ...pos.map((p) => p.requestedBy)].filter(Boolean))].sort(), [travel, reimb, pos]);
  const projOpts = useMemo(() => [...new Set([...pos, ...travel, ...reimb].map((x) => x.project).filter(Boolean))].sort(), [pos, travel, reimb]);
  const deptOpts = useMemo(() => [...new Set([...DEPTS, ...pos.map((p) => p.dept), ...travel.map((t) => t.dept), ...reimb.map((r) => r.dept)].filter(Boolean))].sort(), [pos, travel, reimb]);
  const clientOpts = useMemo(() => [...new Set([...travel.map((t) => t.client), ...reimb.map((r) => r.client)].filter(Boolean))].sort(), [travel, reimb]);
  const vendorOpts = useMemo(() => [...new Set(pos.map((p) => p.vendor).filter(Boolean))].sort(), [pos]);

  // ---- 9-stage pipeline ----
  const flow = useMemo(() => ([
    ['PO', V.pos.filter((p) => p.approval !== 'Approved').length],
    ['Travel advance', V.travel.filter((t) => t.billsSubmitted !== 'Yes' && !settled(t)).length],
    ['Expense submission', V.travel.filter((t) => t.billsSubmitted === 'Yes' && t.hardcopy !== 'Yes' && !settled(t)).length],
    ['Hardcopy verification', V.travel.filter((t) => t.hardcopy === 'Yes' && !verifState(t).complete && !settled(t)).length],
    ['Settlement', V.travel.filter((t) => verifState(t).complete && !settled(t)).length],
    ['Reimbursement', V.reimb.filter((r) => r.status === 'Pending').length],
    ['Approval', V.reimb.filter((r) => r.status === 'Raised' && r.approval !== 'Approved').length],
    ['Payment', V.reimb.filter((r) => r.status === 'Raised' && r.approval === 'Approved' && r.payment !== 'Paid').length
      + V.pos.filter((p) => p.approval === 'Approved' && p.payment === 'Pending').length],
    ['Closure', V.pos.filter((p) => p.payment === 'Paid').length
      + V.travel.filter((t) => settled(t)).length
      + V.reimb.filter((r) => r.status === 'Closed').length],
  ]), [V]);

  // ---- KPI totals ----
  const T = useMemo(() => {
    const sum = (a, f) => a.reduce((s, x) => s + (Number(f(x)) || 0), 0);
    const poPending = V.pos.filter((p) => ['Pending', 'In Review'].includes(p.approval));
    const poApproved = V.pos.filter((p) => p.approval === 'Approved');
    const poUnpaid = poApproved.filter((p) => p.payment === 'Pending');
    const advOut = V.travel.filter((t) => !settled(t) && Number(t.advance || 0) > 0);
    const tsPending = V.travel.filter((t) => !settled(t));
    const billsPend = V.travel.filter((t) => t.billsSubmitted === 'Yes' && !verifState(t).complete && !settled(t));
    const toRaise = V.reimb.filter((r) => r.status === 'Pending');
    const raisedUnpaid = V.reimb.filter((r) => r.status === 'Raised' && r.payment !== 'Paid');
    const payable = tsPending.reduce((s, t) => { const b = travelCalc(t, reimb).balance; return s + (b < 0 ? -b : 0); }, 0);
    const recover = tsPending.reduce((s, t) => { const b = travelCalc(t, reimb).balance; return s + (b > 0 && verifState(t).complete ? b : 0); }, 0);
    const poAmt = sum(poUnpaid, (p) => p.amount);
    const toRaiseAmt = sum(toRaise, (r) => r.amount);
    const raisedAmt = sum(raisedUnpaid, (r) => r.amount);
    return {
      poPending, poApproved, poUnpaid, advOut, tsPending, billsPend, toRaise, raisedUnpaid,
      payable, recover, poAmt, toRaiseAmt, raisedAmt, sum,
      total: poAmt + payable + toRaiseAmt + raisedAmt,
    };
  }, [V, reimb]);

  // ---- action centre ----
  const actions = useMemo(() => {
    const out = [];
    for (const p of V.pos) {
      if (['Pending', 'In Review'].includes(p.approval)) {
        out.push({ k: 'po', sev: p.approval === 'Pending' ? 'warn' : 'info', what: 'PO pending approval', who: `${p.poNo} · ${p.vendor} · ${p.project}`, amt: p.amount, act: 'Update', id: p.id, view: 'po' });
      }
    }
    for (const t of V.travel) {
      const c = travelCalc(t, reimb);
      const vs = verifState(t);
      if (Number(t.advance || 0) > 0 && ['Not started', 'Pending'].includes(t.settlement)) {
        out.push({ k: 'adv', sev: 'warn', what: 'Travel advance pending settlement', who: `${t.empName} · ${t.location} · ${fmtD(t.from)}`, amt: t.advance, act: 'View', id: t.id, view: 'travel' });
      }
      if (t.billsSubmitted !== 'Yes' && !settled(t)) {
        out.push({ k: 'docs', sev: 'crit', what: 'Missing supporting documents', who: `${t.empName} · bills not submitted for ${t.location} trip`, amt: t.advance, act: 'Update', id: t.id, view: 'travel' });
      } else if (t.billsSubmitted === 'Yes' && t.hardcopy !== 'Yes' && !settled(t)) {
        out.push({ k: 'hard', sev: 'crit', what: 'Hardcopy bills not received', who: `${t.empName} · ${t.location} · ${fmtD(t.from)}`, amt: c.claimed, act: 'Update', id: t.id, view: 'travel' });
      }
      if (t.hardcopy === 'Yes' && !vs.complete && !settled(t)) {
        out.push({ k: 'verify', sev: 'warn', what: 'Bills pending verification', who: `${t.empName} · ${vs.done}/${vs.total} checks done`, amt: c.claimed, act: 'Verify', id: t.id, view: 'verify' });
      }
      if (t.v?.missing && !settled(t)) {
        out.push({ k: 'docs', sev: 'crit', what: 'Missing supporting documents', who: `${t.empName} · ${t.v.missing}`, amt: null, act: 'Verify', id: t.id, view: 'verify' });
      }
      if (c.balance > 0 && vs.complete && !settled(t)) {
        out.push({ k: 'recover', sev: 'warn', what: 'Employee advance pending recovery', who: `${t.empName} · ${t.empId}`, amt: c.balance, act: 'Close', close: 'travel', id: t.id });
      }
      if (c.balance < 0 && vs.complete && !settled(t)) {
        out.push({ k: 'payable', sev: 'info', what: 'Additional amount payable to employee', who: `${t.empName} · ${t.empId}`, amt: -c.balance, act: 'Update', id: t.id, view: 'travel' });
      }
    }
    for (const r of V.reimb) {
      if (r.status === 'Pending') {
        out.push({ k: 'raise', sev: 'warn', what: 'Reimbursement yet to be raised', who: `${r.client} · ${r.empName} · ${fmtD(r.from)}`, amt: r.amount, act: 'Raise', raise: true, id: r.id });
      }
      if (r.status !== 'Closed' && r.hosp === 'Yes' && !(r.docs || []).length) {
        out.push({ k: 'docs', sev: 'crit', what: 'Missing supporting documents', who: `${r.client} hospitality · ${r.empName}`, amt: null, act: 'Update', id: r.id, view: 'reimb' });
      }
      if (r.status === 'Raised' && r.approval !== 'Approved') {
        out.push({ k: 'rappr', sev: 'info', what: 'Reimbursement awaiting approval', who: `${r.refNo || 'No ref'} · ${r.client}`, amt: r.amount, act: 'Update', id: r.id, view: 'reimb' });
      }
      if (r.status === 'Raised' && r.approval === 'Approved' && r.payment !== 'Paid') {
        out.push({ k: 'rpay', sev: 'info', what: 'Reimbursement awaiting payment', who: `${r.refNo} · ${r.client}`, amt: r.amount, act: 'Update', id: r.id, view: 'reimb' });
      }
      if (r.status === 'Raised' && r.payment === 'Paid') {
        out.push({ k: 'rclose', sev: 'info', what: 'Paid — ready to close', who: `${r.refNo} · ${r.client}`, amt: r.amount, act: 'Close', close: 'reimb', id: r.id });
      }
    }
    const rank = { crit: 0, warn: 1, info: 2 };
    return out.sort((a, b) => rank[a.sev] - rank[b.sev]);
  }, [V, reimb]);

  const auditEvents = useMemo(() => {
    const ev = [];
    for (const p of V.pos) for (const h of p.history ?? []) ev.push({ ...h, ref: p.poNo, kind: 'PO' });
    for (const t of V.travel) for (const h of t.history ?? []) ev.push({ ...h, ref: `${t.empName} · ${t.location}`, kind: 'Travel' });
    for (const r of V.reimb) for (const h of r.history ?? []) ev.push({ ...h, ref: `${r.client} · ${r.empName}`, kind: 'Claim' });
    return ev.sort((a, b) => String(b.t ?? '').localeCompare(String(a.t ?? ''))).slice(0, 200);
  }, [V]);

  const drawerRecord = useMemo(() => {
    if (!drawer?.id) return null;
    if (drawer.view === 'po') return pos.find((x) => x.id === drawer.id) ?? null;
    if (drawer.view === 'travel' || drawer.view === 'verify') return travel.find((x) => x.id === drawer.id) ?? null;
    return reimb.find((x) => x.id === drawer.id) ?? null;
  }, [drawer, pos, travel, reimb]);

  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDrawer(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer]);

  const kpis = [
    { t: 'Purchase Orders – Pending', v: T.poPending.length, a: T.sum(T.poPending, (p) => p.amount), sub: 'Pending or in review', c: 'var(--warn)', go: 'po' },
    { t: 'Purchase Orders – Approved', v: T.poApproved.length, a: T.sum(T.poApproved, (p) => p.amount), sub: `${T.poUnpaid.length} awaiting vendor payment`, c: 'var(--ok)', go: 'po' },
    { t: 'Travel Advances – Outstanding', v: T.advOut.length, a: T.sum(T.advOut, (t) => t.advance), sub: 'Advance given, not settled', c: 'var(--warn)', go: 'travel' },
    { t: 'Travel Settlements – Pending', v: T.tsPending.length, a: null, sub: `${inr(T.payable)} payable · ${inr(T.recover)} to recover`, c: 'var(--info)', go: 'travel' },
    { t: 'Bills Pending Verification', v: T.billsPend.length, a: T.sum(T.billsPend, (t) => travelCalc(t, reimb).claimed), sub: 'Claimed value under check', c: 'var(--warn)', go: 'verify' },
    { t: 'Reimbursements to be Raised', v: T.toRaise.length, a: T.toRaiseAmt, sub: 'Client claims not yet raised', c: 'var(--warn)', go: 'reimb' },
    { t: 'Reimbursements Raised – Pending Payment', v: T.raisedUnpaid.length, a: T.raisedAmt, sub: 'Raised, awaiting approval or payment', c: 'var(--accent)', go: 'reimb' },
  ];
  const tabDefs = [
    ['overview', 'Action Centre', actions.length],
    ['po', 'Purchase Orders', V.pos.length],
    ['travel', 'Travel Settlements', V.travel.length],
    ['verify', 'Bill Verification', V.travel.filter((t) => t.billsSubmitted === 'Yes' && !settled(t)).length],
    ['reimb', 'Client Hospitality & Claims', V.reimb.length],
    ['audit', 'Audit Trail', null],
  ];
  const counts = {};
  for (const a of actions) counts[a.k] = (counts[a.k] ?? 0) + 1;
  const chipList = AC_GROUPS.filter(([k]) => k === 'all' || counts[k]);
  const chipRows = actions.filter((a) => acFilter === 'all' || a.k === acFilter);
  const segs = [
    ['Vendor POs', T.poAmt, 'var(--accent)'],
    ['Employee payables', T.payable, 'var(--ok)'],
    ['Claims to raise', T.toRaiseAmt, 'var(--warn)'],
    ['Claims raised', T.raisedAmt, 'var(--info)'],
  ];
  const segTot = segs.reduce((s, x) => s + x[1], 0) || 1;
  const doneInfo = {
    v: V.travel.filter((t) => verifState(t).complete).length,
    closed: V.travel.filter((t) => settled(t)).length + V.reimb.filter((r) => r.status === 'Closed').length + V.pos.filter((p) => p.payment === 'Paid').length,
    paid: V.reimb.filter((r) => r.payment === 'Paid').length + V.pos.filter((p) => p.payment === 'Paid').length,
  };

  const openAction = (a) => {
    if (a.raise) {
      const r = reimb.find((x) => x.id === a.id);
      if (r) void raiseReimb(r);
      return;
    }
    if (a.close === 'travel') {
      const t = travel.find((x) => x.id === a.id);
      if (t) void closeTravel(t);
      return;
    }
    if (a.close === 'reimb') {
      const r = reimb.find((x) => x.id === a.id);
      if (r) void closeReimb(r);
      return;
    }
    setDrawer({ view: a.view, mode: 'edit', id: a.id });
  };

  if (allQ.isLoading) {
    return (
      <div id="finOccPanel"><div className="wrap">
        <header className="top"><div className="brand">
          <span className="eyebrow">DesignTree Service Consultants · Finance Operations</span>
          <h1>Finance Operations Control Centre</h1>
        </div></header>
        <p style={{ color: 'var(--ink-2)' }}>Loading records…</p>
      </div></div>
    );
  }
  if (allQ.isError) {
    return (
      <div id="finOccPanel"><div className="wrap">
        <header className="top"><div className="brand">
          <span className="eyebrow">DesignTree Service Consultants · Finance Operations</span>
          <h1>Finance Operations Control Centre</h1>
        </div></header>
        <p role="alert">{allQ.error.message}</p>
      </div></div>
    );
  }

  return (
    <div id="finOccPanel">
      <div className="wrap">
        <header className="top">
          <div className="brand">
            <span className="eyebrow">DesignTree Service Consultants · Finance Operations</span>
            <h1>Finance Operations Control Centre</h1>
          </div>
          <div className="top-meta">
            <span className="live on"><i /><span>Live · server data</span></span>
            <span className="mono">{todayLine()}</span>
            {canDecide && (
              <>
                <button className="btn" type="button" onClick={() => setDrawer({ view: 'travel', mode: 'create' })}>+ Travel advance</button>
                <button className="btn" type="button" onClick={() => setDrawer({ view: 'reimb', mode: 'create' })}>+ Hospitality / claim</button>
                <button className="btn primary" type="button" onClick={() => setDrawer({ view: 'po', mode: 'create' })}>+ Purchase order</button>
              </>
            )}
          </div>
        </header>

        {legacy && (
          <div className="banner" style={{ marginBottom: 12 }}>
            This browser has {((legacy.advances?.length ?? 0) + (legacy.claims?.length ?? 0) + (legacy.pos?.length ?? 0))} unsynced local entries from the old offline version. Server is now the source of truth.
            {' '}<button type="button" className="btn sm ghost" onClick={() => { localStorage.removeItem(LEGACY_KEY); setLegacy(null); }}>Discard browser data</button>
          </div>
        )}

        <section className="filters" aria-label="Filters">
          <div className="fld"><label htmlFor="fFrom">From date</label><input type="date" id="fFrom" value={fFrom} onChange={(e) => setFFrom(e.target.value)} /></div>
          <div className="fld"><label htmlFor="fTo">To date</label><input type="date" id="fTo" value={fTo} onChange={(e) => setFTo(e.target.value)} /></div>
          <div className="fld"><label htmlFor="fEmp">Employee</label><select id="fEmp" value={fEmp} onChange={(e) => setFEmp(e.target.value)}><option value="">All employees</option>{empOpts.map((v) => <option key={v}>{v}</option>)}</select></div>
          <div className="fld"><label htmlFor="fProj">Project</label><select id="fProj" value={fProj} onChange={(e) => setFProj(e.target.value)}><option value="">All projects</option>{projOpts.map((v) => <option key={v}>{v}</option>)}</select></div>
          <div className="fld"><label htmlFor="fDept">Department</label><select id="fDept" value={fDept} onChange={(e) => setFDept(e.target.value)}><option value="">All departments</option>{deptOpts.map((v) => <option key={v}>{v}</option>)}</select></div>
          <div className="fld"><label htmlFor="fClient">Client</label><select id="fClient" value={fClient} onChange={(e) => setFClient(e.target.value)}><option value="">All clients</option>{clientOpts.map((v) => <option key={v}>{v}</option>)}</select></div>
          <div className="fld"><label htmlFor="fVendor">Vendor</label><select id="fVendor" value={fVendor} onChange={(e) => setFVendor(e.target.value)}><option value="">All vendors</option>{vendorOpts.map((v) => <option key={v}>{v}</option>)}</select></div>
          <div className="fld"><label htmlFor="fPO">PO status</label><select id="fPO" value={fPO} onChange={(e) => setFPO(e.target.value)}><option value="">Any</option>{PO_APPROVAL.map((v) => <option key={v}>{v}</option>)}</select></div>
          <div className="fld"><label htmlFor="fTS">Travel settlement</label><select id="fTS" value={fTS} onChange={(e) => setFTS(e.target.value)}><option value="">Any</option>{OCC_SETTLEMENTS.map((v) => <option key={v}>{v}</option>)}</select></div>
          <div className="fld"><label htmlFor="fRS">Reimbursement</label><select id="fRS" value={fRS} onChange={(e) => setFRS(e.target.value)}><option value="">Any</option>{CLAIM_STATUS.map((v) => <option key={v}>{v}</option>)}</select></div>
          <div className="fld"><label htmlFor="fPay">Payment status</label><select id="fPay" value={fPay} onChange={(e) => setFPay(e.target.value)}><option value="">Any</option>{['Pending', 'Paid'].map((v) => <option key={v}>{v}</option>)}</select></div>
          <div className="actions">
            <span>{activeFilters ? `${activeFilters} filter${activeFilters > 1 ? 's' : ''} active · ${V.pos.length} POs, ${V.travel.length} trips, ${V.reimb.length} claims` : `Showing all records · ${V.pos.length} POs, ${V.travel.length} trips, ${V.reimb.length} claims`}</span>
            <button className="btn sm ghost" type="button" onClick={clearFilters}>Clear filters</button>
          </div>
        </section>

        <section className="flow" aria-label="Workflow stages">
          {flow.map(([n, c], i) => {
            const last = i === flow.length - 1;
            const cls = last ? 'done' : c > 0 ? 'hot' : '';
            return (
              <div key={n} className={`stage ${cls}`}>
                <span className="sn">Stage {i + 1}{last ? '' : ' · open'}</span>
                <span className="st">{n}</span>
                <span className="sc">{c}</span>
                <span className="bar" />
              </div>
            );
          })}
        </section>

        <section className="kpis" aria-label="Summary">
          {kpis.map((x) => (
            <button key={x.t} className="kpi" type="button" onClick={() => setTab(x.go)}>
              <span className="kh"><span className="kt">{x.t}</span><span className="dot" style={{ background: x.c }} /></span>
              <span className="kv">{x.v}</span>
              {x.a != null && <span className="ka">{inr(x.a)}</span>}
              <span className="ks">{x.sub}</span>
            </button>
          ))}
          <button className="kpi total" type="button" onClick={() => setTab('overview')}>
            <span className="kh"><span className="kt">Total Amount Pending</span></span>
            <span className="kv">{inrShort(T.total)}</span>
            <span className="ka">{inr(T.total)}</span>
            <span className="ks">Vendor POs + employee payables + client claims</span>
          </button>
        </section>

        <nav className="tabs" role="tablist">
          {tabDefs.map(([id, label, c]) => (
            <button key={id} className="tab" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}{c != null && <span className="c">{c}</span>}
            </button>
          ))}
        </nav>

        <main className="panel">
          {tab === 'overview' && (
            <div className="ac-grid">
              <section className="card" aria-labelledby="acH">
                <div className="card-h"><h3 id="acH">Action required</h3><span className="hint">{actions.length} item{actions.length === 1 ? '' : 's'} · most urgent first</span></div>
                <div className="chips">
                  {chipList.map(([k, label]) => (
                    <button key={k} className="chip" type="button" aria-pressed={acFilter === k} onClick={() => setAcFilter(k)}>
                      {label} <b>{k === 'all' ? actions.length : counts[k]}</b>
                    </button>
                  ))}
                </div>
                {chipRows.length ? (
                  <ul className="ai-list">
                    {chipRows.map((a, i) => (
                      <li key={i} className="ai">
                        <span className={`sev ${a.sev}`} />
                        <div>
                          <div className="what">{a.what}</div>
                          <div className="who">{a.who}</div>
                          {a.amt != null && <div className="amt">{inr(a.amt)}</div>}
                        </div>
                        {((a.raise || a.close) && !canDecide) ? null : (
                          <button className={`btn sm${a.act === 'Raise' || a.act === 'Verify' || a.act === 'Close' ? ' primary' : ''}`} type="button" onClick={() => openAction(a)}>{a.act}</button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : <div className="empty">Nothing needs attention for these filters.</div>}
              </section>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <section className="card">
                  <div className="card-h"><h3>Where the pending money sits</h3><span className="num">{inrShort(T.total)}</span></div>
                  <div className="stackbar">{segs.map((s) => <span key={s[0]} style={{ width: `${(s[1] / segTot) * 100}%`, background: s[2] }} title={`${s[0]}: ${inr(s[1])}`} />)}</div>
                  <div className="legend">{segs.map((s) => <span key={s[0]}><i className="dot" style={{ background: s[2] }} />{s[0]}</span>)}</div>
                  <div className="mini-rows">
                    {segs.map((s) => <div key={s[0]} className="mini"><span>{s[0]}</span><span className="num">{inr(s[1])}</span></div>)}
                    <div className="mini"><span>Advance to recover from employees</span><span className="num bal-rec">{inr(T.recover)}</span></div>
                  </div>
                </section>
                <section className="card">
                  <div className="card-h"><h3>Completed</h3></div>
                  <div className="mini-rows">
                    <div className="mini"><span>Travel bills fully verified</span><span className="num">{doneInfo.v}</span></div>
                    <div className="mini"><span>Items paid</span><span className="num">{doneInfo.paid}</span></div>
                    <div className="mini"><span>Items closed</span><span className="num">{doneInfo.closed}</span></div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {tab === 'po' && (
            <>
              <div className="panel-head"><div><h2>Purchase order management</h2><p>Create and update POs, attach the signed PO and quotes, and track approval and vendor payment. Rows marked on the left are still waiting for approval.</p></div>
                {canDecide && <button className="btn primary" type="button" onClick={() => setDrawer({ view: 'po', mode: 'create' })}>+ New PO</button>}
              </div>
              <div className="tbl-wrap"><table><thead><tr><th>PO number</th><th>Project / Dept</th><th>Vendor</th><th>PO date</th><th className="r">Amount</th><th>Requested by</th><th>Approval</th><th>Payment</th><th>Documents</th><th>Remarks</th><th /></tr></thead>
                <tbody>
                  {V.pos.map((p) => (
                    <tr key={p.id} className={['Pending', 'In Review'].includes(p.approval) ? 'flag' : ''}>
                      <td className="mono">{p.poNo || p.id.slice(-6)}</td>
                      <td>{p.project || '—'}<div className="sub">{p.dept || '—'}</div></td>
                      <td>{p.vendor || '—'}</td>
                      <td className="mono">{fmtD(p.date)}</td>
                      <td className="r num">{inr(p.amount)}</td>
                      <td>{p.requestedBy || '—'}</td>
                      <td><Pill v={p.approval} /></td>
                      <td><Pill v={p.payment} /></td>
                      <td><Docs docs={p.docs} /></td>
                      <td className="sub" style={{ minWidth: 160 }}>{p.remarks || '—'}</td>
                      <td><div className="row-actions"><button className="btn sm" type="button" onClick={() => setDrawer({ view: 'po', mode: 'edit', id: p.id })}>Update</button></div></td>
                    </tr>
                  )) || <tr><td colSpan={11} className="empty">No purchase orders match these filters.</td></tr>}
                  {V.pos.length === 0 && <tr><td colSpan={11} className="empty">No purchase orders match these filters.</td></tr>}
                </tbody></table></div>
            </>
          )}

          {tab === 'travel' && (
            <>
              <div className="panel-head"><div><h2>Travel advance &amp; settlement</h2><p>Balance = advance received − eligible expenses. Expenses already covered by client hospitality are excluded from eligible amounts and flagged, so they are not paid twice.</p></div>
                {canDecide && <button className="btn primary" type="button" onClick={() => setDrawer({ view: 'travel', mode: 'create' })}>+ New travel advance</button>}
              </div>
              <div className="tbl-wrap"><table><thead><tr><th>Employee</th><th>Project / Dept</th><th>Purpose &amp; location</th><th>Travel dates</th><th className="r">Advance</th><th className="r">Claimed</th><th className="r">Eligible</th><th className="r">Balance</th><th>Bills</th><th>Hardcopy</th><th>Verification</th><th>Settlement</th><th /></tr></thead>
                <tbody>
                  {V.travel.map((t) => {
                    const c = travelCalc(t, reimb);
                    const vs = verifState(t);
                    const bal = c.balance;
                    return (
                      <tr key={t.id}>
                        <td><b>{t.empName}</b><div className="sub mono">{t.empId || '—'}</div></td>
                        <td>{t.project || '—'}<div className="sub">{t.dept || '—'}{t.client ? ` · ${t.client}` : ''}</div></td>
                        <td>{t.purpose || '—'}<div className="sub">{t.location || '—'}</div>{c.exList.length > 0 && <div className="flagtag" title="Excluded from eligible expenses">Client-covered: {c.exList.join(', ')}</div>}</td>
                        <td className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtD(t.from)}<div className="sub">to {fmtD(t.to)}</div></td>
                        <td className="r num">{inr(t.advance)}<div className="sub">{fmtD(t.advDate)}</div></td>
                        <td className="r num">{inr(c.claimed)}</td>
                        <td className="r num">{inr(c.eligible)}</td>
                        <td className={`r num ${bal > 0 ? 'bal-rec' : bal < 0 ? 'bal-pay' : ''}`}>{inr(Math.abs(bal))}<div className="sub">{bal > 0 ? 'Recover from employee' : bal < 0 ? 'Payable to employee' : 'Nil'}</div></td>
                        <td><Pill v={t.billsSubmitted} /></td>
                        <td><Pill v={t.hardcopy} /></td>
                        <td><Pill v={vs.status} /></td>
                        <td><Pill v={t.settlement} /></td>
                        <td><div className="row-actions">
                          <button className="btn sm" type="button" onClick={() => setDrawer({ view: 'travel', mode: 'edit', id: t.id })}>Update</button>
                          <button className="btn sm" type="button" onClick={() => setDrawer({ view: 'verify', mode: 'edit', id: t.id })}>Verify</button>
                        </div></td>
                      </tr>
                    );
                  })}
                  {V.travel.length === 0 && <tr><td colSpan={13} className="empty">No trips match these filters.</td></tr>}
                </tbody></table></div>
            </>
          )}

          {tab === 'verify' && (
            <>
              <div className="panel-head"><div><h2>Hardcopy bill verification</h2><p>A settlement can only move to Verified, Approved, Paid or Closed once every bill category with a claimed amount is ticked, the original hardcopy is received, amounts match, and the verifier and date are recorded.</p></div></div>
              <div className="vgrid">
                {V.travel.filter((t) => t.billsSubmitted === 'Yes').sort((a, b) => Number(verifState(a).complete) - Number(verifState(b).complete)).map((t) => {
                  const vs = verifState(t);
                  const v = t.v ?? {};
                  const exp = t.exp ?? {};
                  return (
                    <article key={t.id} className="vcard">
                      <div className="vh"><div><b>{t.empName}</b><div className="sub">{t.location} · {fmtD(t.from)} · {t.project}</div></div><Pill v={vs.status} /></div>
                      <div className="progress" aria-label={`${vs.done} of ${vs.total} checks`}><span style={{ width: `${vs.total ? (vs.done / vs.total) * 100 : 0}%` }} /></div>
                      <div className="ticks">
                        {CATS.map(([k, label]) => {
                          const na = !(Number(exp[k] ?? 0) > 0);
                          return <span key={k} className={`tick ${na ? 'na' : v[k] ? 'ok' : 'need'}`}><i>{!na && v[k] ? '✓' : ''}</i>{label.replace(' bills', '')}</span>;
                        })}
                        <span className={`tick ${t.hardcopy === 'Yes' && v.original ? 'ok' : 'need'}`}><i>{t.hardcopy === 'Yes' && v.original ? '✓' : ''}</i>Original received</span>
                        <span className={`tick ${v.match ? 'ok' : 'need'}`}><i>{v.match ? '✓' : ''}</i>Amounts match</span>
                      </div>
                      <div className="sub">{vs.complete ? `Verified by ${v.by || '—'} on ${fmtD(v.date)}` : `Open: ${vs.missing.join(', ')}`}</div>
                      {v.missing && <div className="flagtag">Missing: {v.missing}</div>}
                      <div className="row-actions">
                        <button className="btn sm primary" type="button" onClick={() => setDrawer({ view: 'verify', mode: 'edit', id: t.id })}>{vs.complete ? 'Review checklist' : 'Verify bills'}</button>
                        <button className="btn sm" type="button" onClick={() => setDrawer({ view: 'travel', mode: 'edit', id: t.id })}>Open settlement</button>
                      </div>
                    </article>
                  );
                })}
                {V.travel.filter((t) => t.billsSubmitted === 'Yes').length === 0 && <div className="empty">No submitted bills match these filters.</div>}
              </div>
            </>
          )}

          {tab === 'reimb' && (
            <>
              <div className="panel-head"><div><h2>Client hospitality &amp; reimbursement claims</h2><p>Record where the client provided accommodation, food or transport, then raise the claim for the remaining eligible amount only. Linked trips exclude the covered categories automatically.</p></div>
                {canDecide && <button className="btn primary" type="button" onClick={() => setDrawer({ view: 'reimb', mode: 'create' })}>+ New record</button>}
              </div>
              <div className="tbl-wrap"><table><thead><tr><th>Employee / Project</th><th>Client</th><th>Travel dates</th><th>Client hospitality</th><th className="r">Eligible amount</th><th>Documents</th><th>Status</th><th>Raised / Ref</th><th>Approval</th><th>Payment</th><th /></tr></thead>
                <tbody>
                  {V.reimb.map((r) => (
                    <tr key={r.id} className={r.hosp === 'Yes' ? 'flag' : ''}>
                      <td><b>{r.empName}</b><div className="sub">{r.project || '—'}</div></td>
                      <td>{r.client || '—'}</td>
                      <td className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtD(r.from)}<div className="sub">to {fmtD(r.to)}</div></td>
                      <td><Pill v={r.hosp || '—'} />{r.hosp === 'Yes' && <div className="sub">{(r.types ?? []).join(', ') || 'Type not set'}</div>}</td>
                      <td className="r num">{inr(r.amount)}</td>
                      <td><Docs docs={r.docs} /></td>
                      <td><Pill v={r.status} /><div className="sub">{r.status === 'Pending' ? 'To be raised' : ''}</div></td>
                      <td className="mono">{r.raisedDate ? fmtD(r.raisedDate) : '—'}<div className="sub">{r.refNo || ''}</div></td>
                      <td><Pill v={r.approval} /></td>
                      <td><Pill v={r.payment} /></td>
                      <td><div className="row-actions">
                        {r.status === 'Pending' && canDecide && <button className="btn sm primary" type="button" onClick={() => { const rec = reimb.find((x) => x.id === r.id); if (rec) void raiseReimb(rec); }}>Raise</button>}
                        <button className="btn sm" type="button" onClick={() => setDrawer({ view: 'reimb', mode: 'edit', id: r.id })}>Update</button>
                      </div></td>
                    </tr>
                  ))}
                  {V.reimb.length === 0 && <tr><td colSpan={11} className="empty">No records match these filters.</td></tr>}
                </tbody></table></div>
            </>
          )}

          {tab === 'audit' && (
            <>
              <div className="panel-head"><div><h2>Audit trail</h2><p>Every create, update, upload, verification, raise and closure is logged against its record with who did it and when.</p></div></div>
              <section className="card"><ul className="audit">
                {auditEvents.slice(0, 200).map((e, i) => (
                  <li key={i}><time>{fmtDT(e.t)}</time><div><b>{e.kind}</b> · {e.ref} — {e.a} <span className="sub">by {e.by ? String(e.by).slice(-6) : '—'}</span></div></li>
                ))}
                {auditEvents.length === 0 && <li className="empty">No activity.</li>}
              </ul></section>
            </>
          )}
        </main>
      </div>

      {drawer && (
        <OccDrawer
          key={`${drawer.view}-${drawer.mode}-${drawer.id ?? 'new'}`}
          drawer={drawer}
          record={drawerRecord}
          employees={employees}
          projects={projects}
          travel={travel}
          reimb={reimb}
          canDecide={canDecide}
          onClose={() => setDrawer(null)}
          onCreate={saveCreate}
          onUpdate={saveUpdate}
          onDecide={runDecide}
          onRaise={raiseReimb}
          onCloseTravel={closeTravel}
          onCloseReimb={closeReimb}
          onOpenVerify={(id) => setDrawer({ view: 'verify', mode: 'edit', id })}
          onRemove={(id) => removeM.mutate(id)}
          busy={createM.isPending || updateM.isPending || decideM.isPending || removeM.isPending}
        />
      )}
      <div className="toast" hidden={!toast}>{toast}</div>
    </div>
  );
}

function Pill({ v }) {
  const s = String(v ?? '');
  if (!s || s === '—') return <span className="pill p-na">—</span>;
  return <span className={`pill p-${s.replace(/\s/g, '')}`}>{s}</span>;
}

function Docs({ docs }) {
  if (!docs?.length) return <span className="sub">None</span>;
  return (
    <div className="docs">
      {docs.map((d, i) => (
        d?.file
          ? <a key={i} className="doc" href={financeOccApi.downloadUrl(d.file)} target="_blank" rel="noreferrer" title={`Open ${d.name}`}>{d.name}</a>
          : <span key={i} className="doc" title="No file attached">{d.name}</span>
      ))}
    </div>
  );
}

function nextRefNo(list, prefix, key) {
  let max = 0;
  for (const x of list) {
    const m = String(x[key] ?? '').match(/(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}
function nextPoNo(list) { return nextRefNo(list, 'DT/PO/26-27/', 'poNo'); }
function nextRcNo(list) { return nextRefNo(list, 'DT/RC/26-27/', 'refNo'); }

// ---------- drawer (create / update / verify) ----------
function OccDrawer({ drawer, record, employees, projects, travel, reimb, canDecide, onClose, onCreate, onUpdate, onDecide, onRaise, onCloseTravel, onCloseReimb, onOpenVerify, onRemove, busy }) {
  const { view, mode, id } = drawer;
  const isNew = mode === 'create';
  const readOnly = !canDecide;

  const [err, setErr] = useState('');
  const [files, setFiles] = useState([]);

  // PO form
  const [po, setPoS] = useState(() => ({
    poNo: record?.poNo ?? '', project: record?.projectId ?? '', dept: record?.dept ?? 'Structural',
    vendor: record?.vendor ?? '', amount: record?.amount ?? '', requestedBy: record?.requestedBy ?? '',
    approval: record?.approval ?? 'Pending', payment: record?.payment ?? 'Pending',
    remarks: record?.remarks ?? '', employee: record?.raw ? idOf(record.raw.employee) : '',
  }));
  // Travel form
  const [tr, setTrS] = useState(() => ({
    employee: record && view !== 'po' && view !== 'reimb' ? (record.employeeId || '') : '',
    project: record?.projectId ?? '', dept: record?.dept ?? 'Structural', client: record?.client ?? '',
    purpose: record?.purpose ?? '', location: record?.location ?? '',
    from: record?.from ?? todayISO(), to: record?.to ?? todayISO(),
    advance: record?.advance ?? '', advDate: record?.advDate ?? todayISO(),
    exp: {
      tickets: record?.exp?.tickets ?? '', hotel: record?.exp?.hotel ?? '', food: record?.exp?.food ?? '',
      local: record?.exp?.local ?? '', cab: record?.exp?.cab ?? '', other: record?.exp?.other ?? '',
    },
    bills: record ? record.billsSubmitted : 'No',
    hard: record ? record.hardcopy : 'No',
    settlement: record?.settlement ?? 'Pending',
    remarks: record?.remarks ?? '',
  }));
  // Verify form
  const [vf, setVfS] = useState(() => {
    const v = record?.v ?? {};
    const checks = {};
    for (const [k] of CATS) checks[k] = v[k] === true;
    return {
      checks,
      hard: record ? record.hardcopy : 'No',
      original: v.original === true ? 'Yes' : '',
      match: v.match === true ? 'Yes' : '',
      by: v.by ?? '', date: v.date ?? '', missing: v.missing ?? '',
    };
  });
  // Reimb form
  const [re, setReS] = useState(() => ({
    travelId: record?.travelId ?? '',
    employee: record?.employeeId ?? '', project: record?.projectId ?? '', client: record?.client ?? '', dept: record?.dept ?? 'Structural',
    from: record?.from ?? todayISO(), to: record?.to ?? todayISO(),
    hosp: record?.hosp || 'Yes', types: record?.types ?? [],
    amount: record?.amount ?? '',
    status: record?.status ?? 'Pending', raisedDate: record?.raisedDate ?? '', refNo: record?.refNo ?? '',
    approval: record?.approval ?? 'Pending', payment: record?.payment ?? 'Pending',
    remarks: record?.remarks ?? '',
  }));

  const setF = (setter) => {
    const upd = (k) => {
      if (typeof k === 'function') return setter(k);
      return (e) => setter((p) => ({ ...p, [k]: e?.target?.value ?? e }));
    };
    return upd;
  };
  const setPo = setF(setPoS);
  const setTr = setF(setTrS);
  const setVf = setF(setVfS);
  const setRe = setF(setReS);

  const deptList = [...new Set([...DEPTS, ...employees.map((e) => e.department).filter(Boolean)])].sort();
  const clientList = [...new Set([...travel.map((t) => t.client), ...reimb.map((r) => r.client)].filter(Boolean))].sort();

  // ---- PO save ----
  async function savePO() {
    const amount = Number(po.amount) || 0;
    if (!po.poNo || !po.vendor || !po.project || !amount) { setErr('PO number, project, vendor and amount are required.'); return; }
    if (po.payment === 'Paid' && po.approval !== 'Approved') { setErr('A PO must be approved before it can be marked Paid.'); return; }
    const body = {
      kind: 'po', employee: po.employee || undefined, project: po.project || undefined,
      poNo: po.poNo, vendor: po.vendor, dept: po.dept || undefined, amount,
      requestedBy: po.requestedBy || undefined, approval: po.approval, payment: po.payment,
      remarks: po.remarks || undefined,
    };
    if (!body.employee) { setErr('Select the requesting employee.'); return; }
    if (isNew) await onCreate('po', body, files);
    else await onUpdate(id, body, files);
  }

  // ---- travel calc + save ----
  const trExp = Object.fromEntries(Object.entries(tr.exp).map(([k, v]) => [k, Number(v) || 0]));
  const trClaimed = Object.values(trExp).reduce((s, n) => s + n, 0);
  const trEligible = trClaimed;
  const trBal = (Number(tr.advance) || 0) - trEligible;
  async function saveTravel() {
    if (!tr.employee) { setErr('Select the employee.'); return; }
    const body = {
      kind: 'advance', employee: tr.employee, project: tr.project || undefined,
      client: tr.client || undefined, purpose: tr.purpose || undefined, location: tr.location || undefined,
      fromDate: tr.from || undefined, toDate: tr.to || undefined,
      amount: Number(tr.advance) || 0, advanceReceived: Number(tr.advance) || 0, advanceDate: tr.advDate || undefined,
      fare: trExp.tickets || undefined, lodgingAmount: trExp.hotel || undefined, foodPerDiem: trExp.food || undefined,
      localConveyance: trExp.local || undefined, cabBills: trExp.cab || undefined, misc: trExp.other || undefined,
      billsSubmitted: tr.bills === 'Yes', hardcopyReceived: tr.hard === 'Yes',
      settlement: tr.settlement, remarks: tr.remarks || undefined,
    };
    if (!isNew) {
      const rec = record;
      const vs = verifState({ ...rec, exp: trExp, billsSubmitted: tr.bills, hardcopy: tr.hard, v: rec.v });
      if (tr.settlement === 'Settled' && !vs.complete) { setErr('Complete the hardcopy verification before closing this settlement.'); return; }
    } else if (tr.settlement === 'Settled') {
      // New advances always open unsettled; mirror the reference (new = Pending).
      body.settlement = 'Pending';
    }
    if (isNew) await onCreate('advance', body, files);
    else await onUpdate(id, body, files);
  }

  // ---- verify save ----
  const vfExp = record?.exp ?? {};
  const vfNeedLive = CATS.filter(([k]) => Number(vfExp[k] ?? 0) > 0).map(([k]) => k);
  // NOTE: hardcopy source depends on drawer context (see below).
  async function saveVerify() {
    const hard = vf.hard;
    const checks = {};
    for (const [k] of CATS) checks[k] = !!vf.checks[k];
    checks.original = vf.original === 'Yes';
    checks.match = vf.match === 'Yes';
    const complete = record.billsSubmitted === 'Yes' && vfNeedLive.length > 0
      && vfNeedLive.every((k) => checks[k]) && hard === 'Yes' && checks.original && checks.match && !!vf.by && !!vf.date;
    const verification = { checks, missing: vf.missing || undefined };
    let status = record.status;
    let note = complete ? 'Hardcopy verification completed' : 'Verification updated';
    if (complete && record.status === 'Pending' && record.settlement !== 'Settled') {
      status = 'Verified';
      note += ' · status moved to Verified';
    }
    if (!complete && ['Verified', 'Approved', 'Paid'].includes(record.status)) {
      status = 'Pending';
      note += ' · status reopened to Pending';
    }
    if (vf.missing) note += ` · missing: ${vf.missing}`;
    await onDecide(id, { status, verification });
    void note;
    notify2(note);
  }
  function notify2(m) { /* toast handled by parent via onDecide message */ void m; }

  // ---- reimb save ----
  const reTrip = travel.find((t) => t.id === re.travelId);
  const reCov = new Set();
  if (re.hosp === 'Yes') for (const ty of re.types) for (const k of HOSP_MAP[ty] ?? []) reCov.add(k);
  const reEligible = reTrip ? (() => {
    let s = 0;
    for (const [k] of CATS) if (!reCov.has(k)) s += Number(reTrip.exp?.[k] ?? 0);
    return s;
  })() : null;
  const reCoveredList = reTrip ? CATS.filter(([k]) => reCov.has(k) && Number(reTrip.exp?.[k] ?? 0) > 0).map(([k, label]) => `${label} ${inr(reTrip.exp[k])}`) : [];
  async function saveReimb() {
    if (!re.employee || !re.client) { setErr('Employee and client are required.'); return; }
    if (re.hosp === 'Yes' && !re.types.length) { setErr('Pick at least one type of hospitality the client provided.'); return; }
    let { status, raisedDate, refNo } = re;
    if (status !== 'Pending' && !refNo) refNo = nextRcNo(reimb);
    if (status !== 'Pending' && !raisedDate) raisedDate = todayISO();
    if (status === 'Closed' && re.payment !== 'Paid') { setErr('Mark the payment as Paid before closing the claim.'); return; }
    const body = {
      kind: 'claim', employee: re.employee, project: re.project || undefined, client: re.client,
      dept: undefined, fromDate: re.from || undefined, toDate: re.to || undefined,
      hosp: re.hosp, hospTypes: re.hosp === 'Yes' ? re.types : [],
      amount: Number(re.amount) || 0, status, raisedDate: raisedDate || undefined, refNo: refNo || undefined,
      approval: re.approval, payment: re.payment, linkedTravel: re.travelId || undefined,
      remarks: re.remarks || undefined,
    };
    if (isNew) await onCreate('claim', body, files);
    else await onUpdate(id, body, files);
  }
  function autofillFromTrip(tripId) {
    const t = travel.find((x) => x.id === tripId);
    if (!t) return;
    setRe((p) => ({
      ...p,
      travelId: tripId,
      employee: p.employee || t.employeeId || '',
      project: p.project || t.projectId || '',
      client: p.client || t.client || '',
      dept: p.dept && p.dept !== 'Structural' ? p.dept : (t.dept || p.dept),
      from: (!p.from || p.from === todayISO()) && t.from ? t.from : p.from,
      to: (!p.to || p.to === todayISO()) && t.to ? t.to : p.to,
    }));
  }

  const title = view === 'po' ? (isNew ? 'New purchase order' : `PO ${record?.poNo}`)
    : view === 'travel' ? (isNew ? 'New travel advance' : `${record?.empName} · ${record?.location}`)
    : view === 'verify' ? (record ? `Verify bills · ${record.empName}` : 'Verify bills')
    : (isNew ? 'New hospitality / claim record' : `${record?.client} · ${record?.empName}`);
  const sub = view === 'po'
    ? (isNew ? '' : `${record?.vendor} · ${record?.project}`)
    : view === 'travel'
      ? (isNew ? 'Record the advance now; add expenses when bills come in.' : `${record?.purpose} · ${fmtD(record?.from)} to ${fmtD(record?.to)}`)
      : view === 'verify'
        ? (record ? `${record.location} · ${fmtD(record.from)} to ${fmtD(record.to)} · claimed ${inr(travelCalc(record, reimb).claimed)}` : '')
        : (isNew ? 'Link the trip so covered expenses are excluded from settlement.' : (record?.refNo || 'Not yet raised'));

  const doSave = view === 'po' ? savePO : view === 'travel' ? saveTravel : view === 'verify' ? saveVerify : saveReimb;
  const saveLabel = busy ? 'Saving…' : view === 'verify' ? 'Save checklist' : 'Save';
  const runAction = (fn) => { setErr(''); Promise.resolve().then(fn).catch((e) => setErr(e.message)); };
  const extraBtns = [];
  if (!readOnly && !isNew && !busy && view === 'travel' && record) {
    extraBtns.push(<button key="checklist" className="btn" type="button" onClick={() => onOpenVerify(id)}>Open checklist</button>);
    extraBtns.push(<button key="close-travel" className="btn" type="button" onClick={() => runAction(() => onCloseTravel(record))}>Close settlement</button>);
  }
  if (!readOnly && !isNew && !busy && view === 'reimb' && record) {
    if (record.status === 'Pending') {
      extraBtns.push(<button key="raise" className="btn primary" type="button" onClick={() => runAction(() => onRaise(record))}>Raise claim</button>);
    } else if (record.status === 'Raised') {
      extraBtns.push(<button key="close-reimb" className="btn" type="button" onClick={() => runAction(() => onCloseReimb(record))}>Close claim</button>);
    }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="dTitle">
        <div className="dh">
          <div><h2 id="dTitle">{title}</h2>{sub && <p>{sub}</p>}</div>
          <button className="btn sm ghost" type="button" aria-label="Close" onClick={onClose}>Close</button>
        </div>
        <div className="db">
          {err && <p role="alert" style={{ color: 'var(--crit)' }}>{err}</p>}
          {view === 'po' && (
            <PoForm po={po} setPo={setPo} employees={employees} projects={projects} record={record} readOnly={readOnly} />
          )}
          {view === 'travel' && (
            <TravelForm
              tr={tr} setTr={setTr} employees={employees} projects={projects} record={record} readOnly={readOnly}
              claimed={trClaimed} eligible={trEligible} bal={trBal} deptList={deptList} clientList={clientList}
            />
          )}
          {view === 'verify' && record && (
            <VerifyForm vf={vf} setVf={setVf} record={record} readOnly={readOnly} />
          )}
          {view === 'reimb' && (
            <ReimbForm
              re={re} setRe={setRe} employees={employees} projects={projects} travel={travel}
              readOnly={readOnly} deptList={deptList} coveredList={reCoveredList} eligible={reEligible}
              onTripChange={autofillFromTrip}
            />
          )}
          <DocHistory record={record} readOnly={readOnly} onUploadedFiles={setFiles} files={files} />
        </div>
        <div className="df">
          <span className="msg" />
          {!readOnly && !isNew && (view !== 'verify') && (
            <button className="btn sm ghost" type="button" disabled={busy} style={{ color: 'var(--crit)', marginRight: 'auto' }} onClick={() => onRemove(id)}>Delete</button>
          )}
          {extraBtns}
          <button className="btn" type="button" disabled={busy} onClick={onClose}>Cancel</button>
          {!readOnly && <button className="btn primary" type="button" disabled={busy} onClick={() => { setErr(''); doSave().catch((e) => setErr(e.message)); }}> {saveLabel}</button>}
        </div>
      </aside>
    </>
  );
}

function Fld({ id, label, children, full }) {
  return <div className={`fld${full ? ' full' : ''}`}><label htmlFor={id}>{label}</label>{children}</div>;
}

function PoForm({ po, setPo, employees, projects, record, readOnly }) {
  const dis = readOnly ? { disabled: true } : {};
  return (
    <>
      <fieldset><legend>Purchase order</legend>
        <Fld id="po-no" label="PO number"><input id="po-no" value={po.poNo} placeholder={record ? '' : nextPoNo([])} onChange={setPo('poNo')} {...dis} /></Fld>
        <Fld id="po-date" label="PO date"><input id="po-date" type="text" value={record ? fmtD(record.date) : fmtD(todayISO())} disabled /></Fld>
        <Fld id="po-proj" label="Project"><input id="po-proj" value={projects.find((p) => String(p._id ?? p.id) === po.project)?.name ?? po.project} list="dl-proj" onChange={(e) => {
          const hit = projects.find((p) => p.name === e.target.value);
          setPo('project')({ target: { value: hit ? String(hit._id ?? hit.id) : e.target.value } });
        }} {...dis} /></Fld>
        <Fld id="po-dept" label="Department"><input id="po-dept" value={po.dept} list="dl-dept" onChange={setPo('dept')} {...dis} /></Fld>
        <Fld id="po-vendor" label="Vendor name"><input id="po-vendor" value={po.vendor} onChange={setPo('vendor')} {...dis} /></Fld>
        <Fld id="po-amt" label="PO amount (₹)"><input id="po-amt" type="number" min="0" step="1" value={po.amount} onChange={setPo('amount')} {...dis} /></Fld>
        <Fld id="po-req" label="Requested by"><input id="po-req" value={po.requestedBy} onChange={setPo('requestedBy')} {...dis} /></Fld>
        <Fld id="po-emp" label="Employee (requester)"><select id="po-emp" value={po.employee} onChange={setPo('employee')} {...dis}>
          <option value="">Select employee</option>
          {employees.map((x) => <option key={x._id ?? x.id} value={String(x._id ?? x.id)}>{empName(x)} ({x.empId ?? '—'})</option>)}
        </select></Fld>
        <Fld id="po-appr" label="Approval status"><select id="po-appr" value={po.approval} onChange={setPo('approval')} {...dis}>{PO_APPROVAL.map((o) => <option key={o}>{o}</option>)}</select></Fld>
        <Fld id="po-pay" label="Payment status"><select id="po-pay" value={po.payment} onChange={setPo('payment')} {...dis}>{PO_PAY.map((o) => <option key={o}>{o}</option>)}</select></Fld>
        <div className="fld full"><label htmlFor="po-rem">Remarks</label><textarea id="po-rem" value={po.remarks} onChange={setPo('remarks')} {...dis} /></div>
      </fieldset>
      <datalist id="dl-proj">{projects.map((p) => <option key={p._id ?? p.id} value={p.name} />)}</datalist>
      <datalist id="dl-dept">{[...DEPTS].map((d) => <option key={d} value={d} />)}</datalist>
    </>
  );
}

function TravelForm({ tr, setTr, employees, projects, record, readOnly, claimed, eligible, bal, deptList, clientList }) {
  const dis = readOnly ? { disabled: true } : {};
  const selEmp = employees.find((x) => String(x._id ?? x.id) === tr.employee);
  return (
    <>
      <fieldset><legend>Employee &amp; trip</legend>
        <Fld id="tr-emp" label="Employee name"><select id="tr-emp" value={tr.employee} onChange={setTr('employee')} {...dis}>
          <option value="">Select employee</option>
          {employees.map((x) => <option key={x._id ?? x.id} value={String(x._id ?? x.id)}>{empName(x)}</option>)}
        </select></Fld>
        <Fld id="tr-eid" label="Employee ID"><input id="tr-eid" value={selEmp?.empId ?? record?.empId ?? ''} disabled /></Fld>
        <Fld id="tr-proj" label="Project"><input id="tr-proj" value={projects.find((p) => String(p._id ?? p.id) === tr.project)?.name ?? ''} list="dl-tproj" onChange={(e) => {
          const hit = projects.find((p) => p.name === e.target.value);
          setTr('project')({ target: { value: hit ? String(hit._id ?? hit.id) : '' } });
        }} {...dis} /></Fld>
        <Fld id="tr-dept" label="Department"><input id="tr-dept" value={tr.dept} list="dl-tdept" onChange={setTr('dept')} {...dis} /></Fld>
        <Fld id="tr-client" label="Client"><input id="tr-client" value={tr.client} list="dl-tclient" onChange={setTr('client')} {...dis} /></Fld>
        <Fld id="tr-loc" label="Location"><input id="tr-loc" value={tr.location} onChange={setTr('location')} {...dis} /></Fld>
        <Fld id="tr-purpose" label="Travel purpose"><input id="tr-purpose" value={tr.purpose} onChange={setTr('purpose')} {...dis} /></Fld>
        <Fld id="tr-from" label="Travel from"><input id="tr-from" type="date" value={tr.from} onChange={setTr('from')} {...dis} /></Fld>
        <Fld id="tr-to" label="Travel to"><input id="tr-to" type="date" value={tr.to} onChange={setTr('to')} {...dis} /></Fld>
      </fieldset>
      <datalist id="dl-tproj">{projects.map((p) => <option key={p._id ?? p.id} value={p.name} />)}</datalist>
      <datalist id="dl-tdept">{deptList.map((d) => <option key={d} value={d} />)}</datalist>
      <datalist id="dl-tclient">{clientList.map((c) => <option key={c} value={c} />)}</datalist>
      <fieldset><legend>Advance &amp; actual expenses</legend>
        <Fld id="tr-adv" label="Advance amount received (₹)"><input id="tr-adv" type="number" min="0" value={tr.advance} onChange={setTr('advance')} {...dis} /></Fld>
        <Fld id="tr-advd" label="Date of advance"><input id="tr-advd" type="date" value={tr.advDate} onChange={setTr('advDate')} {...dis} /></Fld>
        {CATS.map(([k, label]) => (
          <Fld key={k} id={`tr-x-${k}`} label={`${label} (₹)`}><input id={`tr-x-${k}`} type="number" min="0" value={tr.exp[k]} onChange={(e) => setTr((p) => ({ ...p, exp: { ...p.exp, [k]: e.target.value } }))} {...dis} /></Fld>
        ))}
        <div className="calc" id="tr-calc">
          <div><span className="lbl">Claimed</span><span className="v">{inr(claimed)}</span></div>
          <div><span className="lbl">Eligible</span><span className="v">{inr(eligible)}</span></div>
          <div><span className="lbl">{bal > 0 ? 'Recover from employee' : bal < 0 ? 'Payable to employee' : 'Balance'}</span><span className={`v ${bal > 0 ? 'bal-rec' : bal < 0 ? 'bal-pay' : ''}`}>{inr(Math.abs(bal))}</span></div>
          <div className="note">Balance = advance {inr(Number(tr.advance) || 0)} − eligible {inr(eligible)}.</div>
        </div>
      </fieldset>
      <fieldset><legend>Bills &amp; settlement</legend>
        <Fld id="tr-bills" label="Bills submitted"><select id="tr-bills" value={tr.bills} onChange={setTr('bills')} {...dis}><option>No</option><option>Yes</option></select></Fld>
        <Fld id="tr-hard" label="Hardcopy bills received"><select id="tr-hard" value={tr.hard} onChange={setTr('hard')} {...dis}><option>No</option><option>Yes</option></select></Fld>
        <div className="fld"><span className="lbl">Bill verification status</span><div><Pill v={record ? verifState({ ...record, exp: Object.fromEntries(Object.entries(tr.exp).map(([k, v]) => [k, Number(v) || 0])), billsSubmitted: tr.bills, hardcopy: tr.hard, v: record.v }).status : 'Pending'} /> <span className="hint">open checklist in Verify</span></div></div>
        <Fld id="tr-set" label="Settlement status"><select id="tr-set" value={tr.settlement} onChange={setTr('settlement')} {...dis}>{OCC_SETTLEMENTS.map((o) => <option key={o}>{o}</option>)}</select></Fld>
        <div className="verdict no">Verified, Approved, Paid and Closed stay locked until the hardcopy checklist is complete. Use Verify to complete it.</div>
        <div className="fld full"><label htmlFor="tr-rem">Remarks</label><textarea id="tr-rem" value={tr.remarks} onChange={setTr('remarks')} {...dis} /></div>
      </fieldset>
    </>
  );
}

function VerifyForm({ vf, setVf, record, readOnly }) {
  const dis = readOnly ? { disabled: true } : {};
  const exp = record?.exp ?? {};
  const need = CATS.filter(([k]) => Number(exp[k] ?? 0) > 0).map(([k]) => k);
  const items = [...need.map((k) => !!vf.checks[k]), vf.hard === 'Yes', vf.original === 'Yes', vf.match === 'Yes', !!vf.by, !!vf.date];
  const done = items.filter(Boolean).length;
  const complete = record.billsSubmitted === 'Yes' && need.length > 0 && done === items.length;
  const missing = [];
  if (record.billsSubmitted !== 'Yes') missing.push('bills not submitted');
  if (vf.hard !== 'Yes') missing.push('hardcopy not received');
  need.forEach((k) => { if (!vf.checks[k]) missing.push(`${CATS.find((c) => c[0] === k)[1].toLowerCase()} unchecked`); });
  if (vf.original !== 'Yes') missing.push('original not confirmed');
  if (vf.match !== 'Yes') missing.push('amount match not confirmed');
  if (!vf.by || !vf.date) missing.push('verifier/date blank');
  return (
    <fieldset><legend>Physical bill checklist</legend>
      {CATS.map(([k, label]) => {
        const amt = Number(exp[k] ?? 0);
        const na = !(amt > 0);
        return (
          <div key={k} className={`checkrow full${na ? ' na' : ''}`}>
            <label><input type="checkbox" checked={!!vf.checks[k]} disabled={na || readOnly} onChange={(e) => setVf((p) => ({ ...p, checks: { ...p.checks, [k]: e.target.checked } }))} /> {label} verified</label>
            <span className="num">{na ? 'Not claimed' : inr(amt)}</span>
          </div>
        );
      })}
      <Fld id="vf-hard" label="Hardcopy bills received"><select id="vf-hard" value={vf.hard} onChange={setVf('hard')} {...dis}><option>No</option><option>Yes</option></select></Fld>
      <Fld id="vf-orig" label="Original hardcopy received"><select id="vf-orig" value={vf.original} onChange={setVf('original')} {...dis}><option value="">—</option><option>Yes</option><option>No</option></select></Fld>
      <Fld id="vf-match" label="Bill amount matches submitted amount"><select id="vf-match" value={vf.match} onChange={setVf('match')} {...dis}><option value="">—</option><option>Yes</option><option>No</option></select></Fld>
      <Fld id="vf-by" label="Verification completed by"><input id="vf-by" value={vf.by} onChange={setVf('by')} {...dis} /></Fld>
      <Fld id="vf-date" label="Verification date"><input id="vf-date" type="date" value={vf.date} onChange={setVf('date')} {...dis} /></Fld>
      <div className="fld full"><label htmlFor="vf-miss">Remarks / missing documents</label><textarea id="vf-miss" value={vf.missing} onChange={setVf('missing')} {...dis} /></div>
      <div className={`verdict ${complete ? 'ok' : 'no'}`}>
        {complete ? 'All checks complete. Saving will mark this settlement Verified.' : `${done}/${items.length} checks done. Still open: ${missing.join(', ')}.`}
      </div>
    </fieldset>
  );
}

function ReimbForm({ re, setRe, employees, projects, travel, readOnly, deptList, coveredList, eligible, onTripChange }) {
  const dis = readOnly ? { disabled: true } : {};
  const trips = [...travel].sort((a, b) => String(b.from || '').localeCompare(String(a.from || '')));
  return (
    <>
      <fieldset><legend>Trip &amp; client</legend>
        <div className="fld full"><label htmlFor="re-trip">Linked travel record</label>
          <select id="re-trip" value={re.travelId} onChange={(e) => { setRe('travelId')({ target: { value: e.target.value } }); onTripChange(e.target.value); }} {...dis}>
            <option value="">Not linked</option>
            {trips.map((t) => <option key={t.id} value={t.id}>{t.empName} · {t.location} · {fmtD(t.from)}</option>)}
          </select>
        </div>
        <Fld id="re-emp" label="Employee name"><select id="re-emp" value={re.employee} onChange={setRe('employee')} {...dis}>
          <option value="">Select employee</option>
          {employees.map((x) => <option key={x._id ?? x.id} value={String(x._id ?? x.id)}>{empName(x)}</option>)}
        </select></Fld>
        <Fld id="re-proj" label="Project"><input id="re-proj" value={projects.find((p) => String(p._id ?? p.id) === re.project)?.name ?? ''} list="dl-rproj" onChange={(e) => {
          const hit = projects.find((p) => p.name === e.target.value);
          setRe('project')({ target: { value: hit ? String(hit._id ?? hit.id) : '' } });
        }} {...dis} /></Fld>
        <Fld id="re-client" label="Client name"><input id="re-client" value={re.client} onChange={setRe('client')} {...dis} /></Fld>
        <Fld id="re-dept" label="Department"><input id="re-dept" value={re.dept} list="dl-rdept" onChange={setRe('dept')} {...dis} /></Fld>
        <Fld id="re-from" label="Travel from"><input id="re-from" type="date" value={re.from} onChange={setRe('from')} {...dis} /></Fld>
        <Fld id="re-to" label="Travel to"><input id="re-to" type="date" value={re.to} onChange={setRe('to')} {...dis} /></Fld>
      </fieldset>
      <datalist id="dl-rproj">{projects.map((p) => <option key={p._id ?? p.id} value={p.name} />)}</datalist>
      <datalist id="dl-rdept">{deptList.map((d) => <option key={d} value={d} />)}</datalist>
      <fieldset><legend>Client hospitality</legend>
        <Fld id="re-hosp" label="Hospitality provided by client" full><select id="re-hosp" value={re.hosp} onChange={setRe('hosp')} {...dis}><option>Yes</option><option>No</option></select></Fld>
        <div className="fld full"><span className="lbl">Type of hospitality</span>
          <div className="types">
            {HOSP_TYPES.map((ty) => (
              <label key={ty}><input type="checkbox" checked={re.types.includes(ty)} disabled={readOnly} onChange={(e) => setRe((p) => ({ ...p, types: e.target.checked ? [...p.types, ty] : p.types.filter((x) => x !== ty) }))} /> {ty}</label>
            ))}
          </div>
        </div>
        <Fld id="re-amt" label="Amount eligible for reimbursement (₹)"><input id="re-amt" type="number" min="0" value={re.amount} onChange={setRe('amount')} {...dis} /></Fld>
        <div className="fld"><span className="lbl">Suggested from trip</span><div className="num">{eligible == null ? 'Link a trip' : inr(eligible)}</div></div>
        {coveredList.length > 0 && <div className="verdict no">Client already covered: {coveredList.join(', ')}. These are excluded from the trip&apos;s eligible expenses and should not be included in this claim.</div>}
      </fieldset>
      <fieldset><legend>Claim status</legend>
        <Fld id="re-status" label="Reimbursement status"><select id="re-status" value={re.status} onChange={setRe('status')} {...dis}>{CLAIM_STATUS.map((o) => <option key={o}>{o}</option>)}</select></Fld>
        <Fld id="re-rdate" label="Raised date"><input id="re-rdate" type="date" value={re.raisedDate} onChange={setRe('raisedDate')} {...dis} /></Fld>
        <Fld id="re-ref" label="Reference number"><input id="re-ref" value={re.refNo} placeholder="Auto-filled when raised" onChange={setRe('refNo')} {...dis} /></Fld>
        <Fld id="re-appr" label="Approval status"><select id="re-appr" value={re.approval} onChange={setRe('approval')} {...dis}>{APPR.map((o) => <option key={o}>{o}</option>)}</select></Fld>
        <Fld id="re-pay" label="Payment status"><select id="re-pay" value={re.payment} onChange={setRe('payment')} {...dis}>{['Pending', 'Paid'].map((o) => <option key={o}>{o}</option>)}</select></Fld>
        <div className="fld full"><label htmlFor="re-rem">Remarks</label><textarea id="re-rem" value={re.remarks} onChange={setRe('remarks')} {...dis} /></div>
      </fieldset>
    </>
  );
}

function DocHistory({ record, readOnly, onUploadedFiles, files }) {
  const [msg, setMsg] = useState('');
  const [picked, setPicked] = useState([]);
  async function attach() {
    if (!picked.length) return;
    onUploadedFiles(picked);
    setPicked([]);
    setMsg('Will attach on Save.');
  }
  return (
    <>
      <fieldset><legend>Documents</legend>
        <div className="full"><Docs docs={record?.docs} /></div>
        {!readOnly && (
          <div className="full upl">
            <input type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setPicked([...e.target.files])} />
            <span className="hint">PDF or image, up to 20 MB each</span>
            {picked.length > 0 && <button className="btn sm" type="button" onClick={attach}>Stage {picked.length} file{picked.length === 1 ? '' : 's'} for upload</button>}
            {files.length > 0 && <span className="hint">{files.length} staged — uploads when you Save.</span>}
            {msg && <span className="hint">{msg}</span>}
          </div>
        )}
      </fieldset>
      {!!record?.history?.length && (
        <fieldset><legend>History</legend>
          <ul className="hist full">
            {[...record.history].reverse().map((h, i) => (
              <li key={i}><time>{fmtDT(h.t)}</time>{h.a} · {h.by ? String(h.by).slice(-6) : '—'}</li>
            ))}
          </ul>
        </fieldset>
      )}
    </>
  );
}
