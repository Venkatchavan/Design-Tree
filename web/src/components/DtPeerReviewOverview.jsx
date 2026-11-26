import { useMemo, useState } from 'react';
import { exportComments } from '../lib/dtPeerReviewExport.js';
import Panel from './Panel.jsx';
import KpiCard from './KpiCard.jsx';
import StatusPill from './StatusPill.jsx';
import EmptyState from './EmptyState.jsx';
import {
  SEVERITIES, RISK, ESCALATE_DAYS, REPEAT_MIN, BUSY_PACKAGES, person, projectName, riskBand,
  applyFilters, kpis, riskMatrix, pipeline, severityCounts, breakdown, reviewerWorkload,
  consultantPerformance, repeatObservations, reviewCycles, dailyActivity, actionCentre,
} from '../lib/dtPeerReviewStats.js';

// DT Peer Review — Management overview (26 Nov 2026): the client's Peer Review
// management dashboard, built from the packages this login can read.

const id = (v) => String(v?._id ?? v ?? '');
const SEV_TONE = { Critical: 'rust', Major: 'amber', Moderate: 'teal', Minor: 'blueprint', Unclassified: 'neutral' };
const RISK_TONE = { High: 'rust', Medium: 'amber', Low: 'forest' };
const TREND_TONE = { Rising: 'rust', Falling: 'forest', Steady: 'neutral' };
const ddmmyyyy = (k) => (k ? k.split('-').reverse().join('.') : '');

// What each login needs (26 Nov 2026):
//  management — Founding Directors, Srinivasa Rao, Peer Review Head: everything.
//  allotment  — Admin allotters: who is loaded, where packages are, what is at risk.
//  reviewer   — the review team: their own open / overdue work and daily activity.
const SECTIONS = {
  management: ['consultant', 'reviewer', 'severity', 'risk', 'days', 'export', 'critical', 'overdue', 'conflicts', 'escalations', 'atRisk', 'matrix', 'pipeline', 'severityPanel', 'breakdown', 'workload', 'consultants', 'repeats', 'cycles', 'daily', 'projects'],
  allotment: ['reviewer', 'risk', 'overdue', 'conflicts', 'atRisk', 'matrix', 'pipeline', 'workload', 'projects'],
  reviewer: ['severity', 'days', 'export', 'critical', 'overdue', 'escalations', 'daily', 'projects'],
};
const TITLES = {
  management: ['Peer Review — Management', 'Structural peer review, all packages'],
  allotment: ['Peer Review — Allotment', 'Review team load, package progress and risk'],
  reviewer: ['My review work', 'The packages allotted to you'],
};


function Table({ head, rows, empty }) {
  return (
    <div className="dtpr-scroll">
      <table className="data">
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.length ? rows : <tr><td colSpan={head.length}>{empty}</td></tr>}</tbody>
      </table>
    </div>
  );
}

function Bar({ label, value, pct, tone }) {
  return (
    <div className="dtpr-bar">
      <span className="dtpr-bar-label">{label}</span>
      <span className="dtpr-bar-track"><span className={`dtpr-bar-fill ${tone ?? ''}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} /></span>
      <span className="dtpr-bar-value">{value}</span>
    </div>
  );
}

export default function DtPeerReviewOverview({ mode = 'reviewer', packages, meta, onOpen }) {
  const has = (key) => (SECTIONS[mode] ?? SECTIONS.reviewer).includes(key);
  const [f, setF] = useState({ project: '', consultant: '', reviewer: '', severity: '', risk: '', days: '' });
  const [category, setCategory] = useState('Analysis');
  const [element, setElement] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  // Ages (overdue, escalations, trends) are measured from when the page opened.
  const [now] = useState(() => Date.now());

  const options = useMemo(() => {
    const consultants = [...new Set(packages.map((p) => p.item.principalConsultant).filter(Boolean))].sort();
    const reviewers = new Map();
    for (const p of packages) for (const e of p.item.reviewTeam ?? []) reviewers.set(id(e), person(e));
    return { consultants, reviewers: [...reviewers].sort((a, b) => a[1].localeCompare(b[1])) };
  }, [packages]);

  const view = useMemo(() => {
    const { packages: pkgs, comments } = applyFilters(packages, f, now);
    const workload = reviewerWorkload(pkgs, now);
    return {
      pkgs, comments, workload,
      k: kpis(pkgs, comments),
      matrix: riskMatrix(pkgs),
      pipe: pipeline(pkgs, meta.stages ?? []),
      sev: severityCounts(comments),
      consultants: consultantPerformance(comments),
      repeats: repeatObservations(comments, now),
      cycles: reviewCycles(pkgs),
      daily: dailyActivity(pkgs, comments),
      actions: actionCentre(pkgs, comments, workload, now),
    };
  }, [packages, f, meta.stages, now]);
  const items = breakdown(view.comments, category, element);
  const categories = Object.keys(meta.categories ?? {});
  const maxLoad = Math.max(1, ...view.workload.map((r) => r.packages));

  if (!packages.length) return <EmptyState text="No peer review packages yet. The overview fills in once a project is allotted." />;
  const { k, actions } = view;
  const open = (p) => <button type="button" className="dtpr-link" onClick={() => onOpen(id(p.item))}>{projectName(p)}</button>;
  const openByName = (name) => {
    const p = view.pkgs.find((x) => projectName(x) === name);
    return p ? open(p) : name;
  };

  const [title, sub] = TITLES[mode] ?? TITLES.reviewer;
  const strip = mode === 'allotment'
    ? [[k.projects, 'Packages'], [k.active, 'Active reviews'], [actions.conflicts.length, 'Resource conflicts'], [actions.atRisk.length, 'At risk'], [k.overdue, 'Overdue']]
    : [[k.projects, mode === 'reviewer' ? 'My packages' : 'Projects'], [k.active, 'Active reviews'], [k.critical, 'Critical issues'], [k.overdue, 'Overdue'], [`${k.closurePct}%`, 'Closure']];
  const cards = [
    has('critical') && <div key="c" className="dtpr-action rust"><b>{actions.critical.count}</b><span>Critical open</span>
      <ul>{actions.critical.projects.slice(0, 3).map((r) => <li key={r.project}>{openByName(r.project)}: {r.count}</li>)}{!actions.critical.count && <li>None open</li>}</ul></div>,
    has('overdue') && <div key="o" className="dtpr-action amber"><b>{actions.overdue.count}</b><span>Overdue</span>
      <ul>{actions.overdue.projects.slice(0, 3).map((r) => <li key={r.project}>{openByName(r.project)}: {r.count}</li>)}{!actions.overdue.count && <li>None overdue</li>}</ul></div>,
    has('conflicts') && <div key="r" className="dtpr-action violet"><b>{actions.conflicts.length}</b><span>Resource conflict</span>
      <ul>{actions.conflicts.slice(0, 3).map((r) => <li key={r.id}>{r.name}: {r.packages} active packages</li>)}{!actions.conflicts.length && <li>No reviewer on {BUSY_PACKAGES}+ packages</li>}</ul></div>,
    has('escalations') && <div key="e" className="dtpr-action rust"><b>{actions.escalations.length}</b><span>Escalation</span>
      <ul>{actions.escalations.slice(0, 3).map((c) => <li key={id(c)}>{openByName(c.project)}: {c.reviewItem || c.topic || c.stage} — {c.days}d</li>)}{!actions.escalations.length && <li>Nothing open past {ESCALATE_DAYS} days</li>}</ul></div>,
    has('atRisk') && <div key="a" className="dtpr-action amber"><b>{actions.atRisk.length}</b><span>At risk</span>
      <ul>{actions.atRisk.slice(0, 3).map((p) => <li key={id(p.item)}>{open(p)}</li>)}{!actions.atRisk.length && <li>None currently</li>}</ul></div>,
  ].filter(Boolean);
  const pair = (a, b) => (a && b ? <div className="dtpr-two">{a}{b}</div> : a || b || null);

  return (
    <>
      <Panel title={title} sub={sub}>
        <div className="dtpr-strip">
          {strip.map(([v, l]) => <div key={l}><b>{v}</b><span>{l}</span></div>)}
        </div>
        <div className="dtpr-form dtpr-filters">
          {packages.length > 1 && (
            <select className="filter-select" aria-label="Project" value={f.project} onChange={set('project')}>
              <option value="">Project (all)</option>
              {packages.map((p) => <option key={id(p.item)} value={id(p.item)}>{projectName(p)}</option>)}
            </select>
          )}
          {has('consultant') && (
            <select className="filter-select" aria-label="Consultant" value={f.consultant} onChange={set('consultant')}>
              <option value="">Consultant (all)</option>
              {options.consultants.map((c) => <option key={c}>{c}</option>)}
            </select>
          )}
          {has('reviewer') && (
            <select className="filter-select" aria-label="Reviewer" value={f.reviewer} onChange={set('reviewer')}>
              <option value="">Reviewer (all)</option>
              {options.reviewers.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          )}
          {has('severity') && (
            <select className="filter-select" aria-label="Severity" value={f.severity} onChange={set('severity')}>
              <option value="">Severity (all)</option>
              {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
            </select>
          )}
          {has('risk') && (
            <select className="filter-select" aria-label="Risk" value={f.risk} onChange={set('risk')}>
              <option value="">Risk (all)</option>
              {RISK.map((s) => <option key={s}>{s}</option>)}
            </select>
          )}
          {has('days') && (
            <select className="filter-select" aria-label="Date raised" value={f.days} onChange={set('days')}>
              <option value="">Date (all)</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>
          )}
          {has('export') && <button type="button" className="btn sm" disabled={!view.comments.length} onClick={() => exportComments(view.comments, `DT-Peer-Review-comments-${new Date().toISOString().slice(0, 10)}`)}>Export comment log to Excel</button>}
        </div>
      </Panel>

      <Panel title={mode === 'reviewer' ? 'Needs my attention' : 'Management action centre'}>
        <div className="dtpr-actions">{cards}</div>
        <p className="dtpr-note">
          {has('overdue') && <>Overdue = no reply within {meta.responseTargetDays ?? 7} days. </>}
          {has('escalations') && <>Escalation = open with no action for more than {ESCALATE_DAYS} days. </>}
          {has('atRisk') && <>At risk = High on the risk matrix. </>}
          {has('conflicts') && <>Resource conflict = a reviewer on {BUSY_PACKAGES} or more active packages.</>}
        </p>
      </Panel>

      {pair(
        has('matrix') && (
          <Panel title="Project risk matrix" sub="Likelihood × impact — click a project to open its report">
            <div className="dtpr-scroll">
              <table className="data dtpr-matrix">
                <thead><tr><th>Likelihood ↓ / Impact →</th>{view.matrix.cols.map((c) => <th key={c}>{c} impact</th>)}</tr></thead>
                <tbody>{view.matrix.rows.map((r) => (
                  <tr key={r}><th>{r}</th>{view.matrix.cols.map((c) => {
                    const band = riskBand(r, c);
                    const list = view.matrix.cells[`${r}|${c}`] ?? [];
                    return <td key={c} className={`band-${band.toLowerCase()}`}>{list.length ? list.map((p) => <div key={id(p.item)}>{open(p)}</div>) : '—'}</td>;
                  })}</tr>
                ))}</tbody>
              </table>
            </div>
            {view.matrix.unrated.length > 0 && <p className="dtpr-note">Not rated yet: {view.matrix.unrated.map((p, i) => <span key={id(p.item)}>{i ? ', ' : ''}{open(p)}</span>)}. Admin or the Peer Review Head sets the rating in the project report.</p>}
          </Panel>
        ),
        has('pipeline') && (
          <Panel title="Review pipeline" sub="Where each package is now">
            {view.pipe.map((r) => <Bar key={r.key} label={r.label} value={r.count} pct={r.pct} tone={r.key === 'released' ? 'forest' : ''} />)}
          </Panel>
        ),
      )}

      {has('severityPanel') && (
        <Panel title="Comment severity" sub="Open comments by severity">
          <div className="kpi-grid cols-3">
            {[...SEVERITIES, 'Unclassified'].map((s) => <KpiCard key={s} label={s} value={view.sev[s]} accent={SEV_TONE[s] === 'neutral' ? undefined : SEV_TONE[s]} />)}
          </div>
          <p className="dtpr-note">Structural safety, stability and seismic-performance issues are Critical; documentation and coordination issues are Minor. The review team sets severity on each comment.</p>
        </Panel>
      )}

      {has('breakdown') && (
        <Panel title="Technical review breakdown" sub="Open comments by review category and structural element">
          <div className="dtpr-form">
            {categories.map((c) => <button key={c} type="button" className={`btn sm${c === category ? ' primary' : ''}`} onClick={() => setCategory(c)}>{c}</button>)}
            <select className="filter-select" aria-label="Structural element" value={element} onChange={(e) => setElement(e.target.value)}>
              <option value="">All elements</option>
              {(meta.elements ?? []).map((el) => <option key={el}>{el}</option>)}
            </select>
          </div>
          <Table head={['Review item', 'Open comments']} empty={`No open ${category} comments${element ? ` on ${element}` : ''}.`}
            rows={items.map((r) => <tr key={r.item}><td>{r.item}</td><td>{r.count}</td></tr>)} />
        </Panel>
      )}

      {pair(
        has('workload') && (
          <Panel title="Reviewer workload" sub="Active packages per allotted reviewer">
            {view.workload.length ? view.workload.map((r) => (
              <Bar key={r.id} label={r.name} value={`${r.packages} pkg · ${r.open} open`} pct={(r.packages / maxLoad) * 100} tone={r.busy ? 'rust' : ''} />
            )) : <EmptyState text="No review team allotted." />}
            <Table head={['Reviewer', 'Active packages', 'Open comments', 'Overdue', 'Hours (7 days)', 'Docs (7 days)']} empty="—"
              rows={view.workload.map((r) => <tr key={r.id}><td>{r.name}</td><td>{r.packages}</td><td>{r.open}</td><td>{r.overdue}</td><td>{r.hours}</td><td>{r.docs}</td></tr>)} />
            <p className="dtpr-note">Hours and documents come from the daily review log in each project report.</p>
          </Panel>
        ),
        has('consultants') && (
          <Panel title="Consultant performance">
            <Table head={['Consultant', 'Comments received', 'Closed', 'Avg response TAT', 'Closure %']} empty="No comments yet."
              rows={view.consultants.map((r) => <tr key={r.name}><td>{r.name}</td><td>{r.received}</td><td>{r.closed}</td><td>{r.avgTat == null ? '—' : `${r.avgTat} days`}</td><td>{r.closurePct}%</td></tr>)} />
            <p className="dtpr-note">Response TAT = days from a DesignTree comment to the consultant&apos;s response.</p>
          </Panel>
        ),
      )}

      {pair(
        has('repeats') && (
          <Panel title="Repeat observations" sub={`Items logged ${REPEAT_MIN}+ times`}>
            <Table head={['Recurring issue', 'Category', 'Occurrences', 'Projects affected', 'Trend']} empty={`No item has been logged ${REPEAT_MIN} or more times yet.`}
              rows={view.repeats.map((r) => <tr key={r.issue}><td>{r.issue}</td><td>{r.category}</td><td>{r.occurrences}</td><td>{r.projects}</td><td><StatusPill tone={TREND_TONE[r.trend]}>{r.trend}</StatusPill></td></tr>)} />
            <p className="dtpr-note">Grouped by review item (or topic when no item is set). Trend compares the last 30 days with the 30 days before.</p>
          </Panel>
        ),
        has('cycles') && (
          <Panel title="Review cycle analysis" sub="Average DesignTree rounds per comment, by project type">
            <Table head={['Project type', 'Projects', 'Comments', 'Avg cycles']} empty="—"
              rows={view.cycles.map((r) => <tr key={r.type}><td>{r.type}</td><td>{r.projects}</td><td>{r.comments}</td><td>{r.avgCycles ?? '—'}</td></tr>)} />
            <p className="dtpr-note">Revision 0 → peer review → comments → revision → re-review … → closure. Project type is set in the project report.</p>
          </Panel>
        ),
      )}

      {has('daily') && (
        <Panel title="Daily review activity" sub="Latest 7 days with activity">
          <Table head={['Date', 'Comments raised', 'Critical raised', 'Re-reviews', 'Responses received', 'Comments closed', 'Hours logged', 'Docs checked']} empty="No activity recorded yet."
            rows={view.daily.map((d) => <tr key={d.date}><td>{ddmmyyyy(d.date)}</td><td>{d.raised}</td><td>{d.critical}</td><td>{d.rereviews}</td><td>{d.responses}</td><td>{d.closed}</td><td>{d.hours}</td><td>{d.docs}</td></tr>)} />
        </Panel>
      )}

      {has('projects') && (
        <Panel title={mode === 'reviewer' ? 'My packages' : 'Projects'}>
          <Table head={mode === 'allotment' ? ['Project', 'Status', 'Current stage', 'Risk', 'Review team', 'Approvals'] : ['Project', 'Status', 'Current stage', 'Open', 'Critical', 'Overdue', 'Checklist']} empty="No project matches the filters."
            rows={view.pkgs.map((p) => {
              const band = riskBand(p.item.likelihood, p.item.impact);
              const mine = view.comments.filter((c) => c.pkg === p && c.state.open);
              return mode === 'allotment' ? (
                <tr key={id(p.item)}>
                  <td>{open(p)}</td><td>{p.summary.status}</td><td>{p.summary.current}</td>
                  <td>{band ? <StatusPill tone={RISK_TONE[band]}>{band}</StatusPill> : 'Not rated'}</td>
                  <td>{(p.item.reviewTeam ?? []).map(person).filter(Boolean).join(', ') || '—'}</td>
                  <td>{p.summary.approvals.done} / {p.summary.approvals.total}</td>
                </tr>
              ) : (
                <tr key={id(p.item)}>
                  <td>{open(p)}</td><td>{p.summary.status}</td><td>{p.summary.current}</td>
                  <td>{mine.length}</td><td>{mine.filter((c) => c.severity === 'Critical').length}</td><td>{mine.filter((c) => c.state.overdue).length}</td>
                  <td>{p.summary.checklist.pct}%</td>
                </tr>
              );
            })} />
        </Panel>
      )}
    </>
  );
}
