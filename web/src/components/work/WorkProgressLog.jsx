import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { hoursText } from '../../lib/workReport.js';
import { groupByEmployee, initials, pillTone, projectKey, projectName, splitEntry } from '../../lib/workProgressLog.js';
import EmptyState from '../EmptyState.jsx';
import './WorkProgressLog.css';

const PAGE_SIZE = 10;


export default function WorkProgressLog({ entries, date, loading, error }) {
  const [project, setProject] = useState('');
  const [service, setService] = useState('');
  const [page, setPage] = useState(1);
  const [closed, setClosed] = useState(() => new Set());
  const [opened, setOpened] = useState(() => new Set());

  const options = useMemo(() => {
    const projects = new Map(), services = new Set();
    for (const entry of entries) for (const row of splitEntry(entry)) {
      projects.set(projectKey(row.project), projectName(row.project));
      if (row.service) services.add(row.service);
    }
    return { projects: [...projects.entries()].sort((a, b) => a[1].localeCompare(b[1])), services: [...services].sort() };
  }, [entries]);
  const groups = useMemo(() => groupByEmployee(entries, { project, service }), [entries, project, service]);

  const pages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = groups.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  // The first employee on a page starts open, like the layout the client shared.
  const isOpen = (g, i) => (i === 0 ? !closed.has(g.key) : opened.has(g.key));
  function toggle(g, i) {
    const flip = (set) => { const next = new Set(set); next.has(g.key) ? next.delete(g.key) : next.add(g.key); return next; };
    if (i === 0) setClosed(flip); else setOpened(flip);
  }
  const day = new Date(`${date}T12:00:00+05:30`).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

  return (
    <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <select aria-label="Work progress project" className="filter-select" value={project} onChange={(e) => { setProject(e.target.value); setPage(1); }}>
          <option value="">All Projects</option>
          {options.projects.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <select aria-label="Work progress service" className="filter-select" value={service} onChange={(e) => { setService(e.target.value); setPage(1); }}>
          <option value="">All Services</option>
          {options.services.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="wpl-day">{day}</div>
      {loading ? <EmptyState text="Loading…" />
        : error ? <div className="login-error" role="alert" style={{ display: 'block' }}>{error.message}</div>
        : !groups.length ? <EmptyState text="No work logged for this date." />
        : shown.map((g, i) => {
          const open = isOpen(g, i);
          return (
            <div key={g.key} className={`wpl-card${open ? ' open' : ''}`}>
              <button type="button" className="wpl-head" aria-expanded={open} onClick={() => toggle(g, i)}>
                <span className="wpl-avatar" aria-hidden="true">{initials(g.name)}</span>
                <span className="wpl-who">
                  <span className="wpl-name">{g.name}</span>
                  <span className="wpl-meta" style={{ display: 'block' }}>{g.rows.length} {g.rows.length === 1 ? 'Activity' : 'Activities'} • {hoursText(g.hours)} Hrs</span>
                </span>
                <ChevronDown className="wpl-chev" size={18} aria-hidden="true" />
              </button>
              {open && (
                <>
                  <div className="wpl-scroll">
                    <table className="wpl-table">
                      <thead><tr><th>Project Name</th><th>Service</th><th>Work Category</th><th>Work Description</th><th className="wpl-hours">Hours</th></tr></thead>
                      <tbody>
                        {g.rows.map((r) => (
                          <tr key={r.key}>
                            <td>{projectName(r.project)}</td>
                            <td>{r.service ? <span className={`wpl-pill t${pillTone(r.service)}`}>{r.service}</span> : '—'}</td>
                            <td>{r.category}</td>
                            <td>{r.description}</td>
                            <td className="wpl-hours"><span className="wpl-hrs">{hoursText(r.hours)}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="wpl-total">Total Hours : {hoursText(g.hours)}</div>
                </>
              )}
            </div>
          );
        })}
      {groups.length > 0 && (
        <div className="wpl-foot">
          <span>Showing {(current - 1) * PAGE_SIZE + 1} – {Math.min(current * PAGE_SIZE, groups.length)} of {groups.length} Employees</span>
          {pages > 1 && (
            <div className="wpl-pager">
              <button type="button" aria-label="Previous page" disabled={current === 1} onClick={() => setPage(current - 1)}>‹</button>
              {Array.from({ length: pages }, (_, n) => n + 1).map((n) => (
                <button key={n} type="button" aria-current={n === current ? 'page' : undefined} onClick={() => setPage(n)}>{n}</button>
              ))}
              <button type="button" aria-label="Next page" disabled={current === pages} onClick={() => setPage(current + 1)}>›</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
