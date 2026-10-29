import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '../lib/api.js';
import { serviceNames } from '../lib/services.js';
import Panel from '../components/Panel.jsx';
import Tabs from '../components/Tabs.jsx';
import './DesignTeamPage.css';
const id = value => String(value?._id ?? value ?? '');
const name = e => e ? [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ') || e.empId || 'Not in records' : 'Not in records';
const projectName = p => `${p?.jobNumber || 'Job number not recorded'} · ${p?.name || 'Project not in records'}`;
const statuses = ['Active', 'On Hold', 'Delayed', 'Awaiting info', 'Ready for billing', 'Completed'];
const point = p => statusOf(p) === 'Completed' ? 0 : ({
  High: 3,
  Medium: 2,
  Low: 1
}[p.complexity] ?? 2) * (statusOf(p) === 'On Hold' ? 0.5 : 1);
const num = n => Number(n ?? 0).toLocaleString('en-IN', {
  maximumFractionDigits: 2
});
const dateText = (v, time = false) => v ? new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  ...(time ? {
    hour: '2-digit',
    minute: '2-digit'
  } : {})
}).format(new Date(v.length === 10 ? v + 'T12:00:00Z' : v)) : 'Not in records';
const statusOf = p => ['On Hold', 'Completed'].includes(p.status) ? p.status : p.coordinationStatus && !['On Hold', 'Completed'].includes(p.coordinationStatus) ? p.coordinationStatus : p.status;
const dayOf = value => new Date(new Date(value).getTime() + 19800000).toISOString().slice(0, 10);
const tone = status => status === 'Delayed' || status === 'No entry' ? 'danger' : status === 'Awaiting info' || status === 'Short day' ? 'warning' : status === 'Completed' || status === 'Full day' ? 'success' : 'normal';
const api = (path = '', method = 'GET', body) => request('/api/design-team' + path, {
  method,
  ...(body !== undefined ? {
    body: JSON.stringify(body)
  } : {})
});
function Load({
  person,
  capacity
}) {
  return <><div className="dm-load-label"><strong>Workload {person.band}</strong><span>{num(person.load)} / {capacity} pts</span></div><progress aria-label="Workload points" max={Math.max(capacity, person.load)} value={person.load} />{person.load > capacity && <span className="dm-danger">Over capacity</span>}</>;
}
function Counts({
  counts
}) {
  return <div className="dm-counts">{Object.entries(counts).map(([label, value]) => <div key={label} className={value && label === 'Delayed' ? 'dm-danger' : value && label === 'Awaiting info' ? 'dm-warning' : ''}><strong>{value}</strong><span>{label}</span></div>)}</div>;
}
function ErrorBox({
  error,
  retry
}) {
  return error ? <div className="login-error" role="alert" style={{
    display: 'block'
  }}>{error.message}{retry && <button type="button" onClick={retry}>Retry</button>}</div> : null;
}
function Dialog({
  title,
  onClose,
  children
}) {
  const ref = useRef(null);
  useEffect(() => {
    const before = document.activeElement,
      root = ref.current,
      overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root?.querySelector('button')?.focus();
    function keys(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Tab') {
        const items = [...root.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')].filter(x => x.getClientRects().length);
        if (!items.length) return;
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', keys);
    return () => {
      document.removeEventListener('keydown', keys);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [onClose]);
  return createPortal(<div className="dm-overlay" onClick={onClose}><section ref={ref} role="dialog" aria-modal="true" aria-label={title} className="dm-drawer" onClick={e => e.stopPropagation()}><header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Close">✕</button></header>{children}</section></div>, document.body);
}
function ProjectLink({
  project,
  onOpen
}) {
  if (!onOpen) return <span>{projectName(project)}</span>;
  return <button type="button" className="dm-link" onClick={() => onOpen(id(project))}>{projectName(project)}</button>;
}
function Logs({
  entries,
  onProject
}) {
  return <>{entries.length ? entries.map(e => <section className="dm-work-entry" key={id(e)}><h4><ProjectLink project={e.project} onOpen={onProject} /> · {dateText(e.date)} · {e.service} · {num(e.totalHours)} h</h4>{(e.areas ?? []).map((a, i) => <div className="dm-work-line" key={i}><strong>{a.key}</strong><span>{a.update || 'No remark in records'}</span><span>{num(a.hours)} h</span></div>)}</section>) : <p>No saved work entries for this selection.</p>}</>;
}
function DayBar({
  entries
}) {
  const groups = [...new Map(entries.map(e => [id(e.project), e.project])).values()].map(p => ({
    project: p,
    hours: entries.filter(e => id(e.project) === id(p)).reduce((s, e) => s + e.totalHours, 0)
  }));
  const total = groups.reduce((s, g) => s + g.hours, 0),
    scale = Math.max(8, total),
    colours = ['#2563eb', '#0f8b8d', '#7c3aed', '#ba4a0c', '#248148'];
  return <><div className="dm-day-bar" aria-label={`${num(total)} hours logged against an eight-hour day`}>{groups.filter(g => g.hours > 0).map((g, i) => <span key={id(g.project)} style={{
        width: g.hours / scale * 100 + '%',
        background: colours[i % colours.length]
      }} title={`${projectName(g.project)}: ${num(g.hours)} h`}>{num(g.hours)} h</span>)}</div><div className="dm-bar-scale"><span>0 h</span><span>{num(scale / 2)} h</span><span>{num(scale)} h</span></div><div className="dm-legend">{groups.map((g, i) => <span key={id(g.project)}><i style={{
          background: colours[i % colours.length]
        }} />{g.project?.name || 'Project not in records'} · {num(g.hours)} h</span>)}</div></>;
}
function Register({
  data,
  onProject,
  onSpoc
}) {
  const [date, setDate] = useState(''),
    [spoc, setSpoc] = useState('');
  const chosen = date || data.days.at(-1),
    days = chosen === 'all' ? data.days : [chosen],
    people = data.spocs.filter(s => !spoc || id(s.employee) === spoc);
  return <section id="dmh-man-hour-register" className="dm-register"><Panel title="Man-hour register" sub="Saved SPOC daily work updates. The entry screen remains the source."><div className="dm-filters"><label>Date<select value={chosen} onChange={e => setDate(e.target.value)}>{data.days.map(d => <option key={d} value={d}>{dateText(d)}{d === data.today ? ' (today)' : ''}</option>)}<option value="all">All of the last 7 working days</option></select></label><label>SPOC<select value={spoc} onChange={e => setSpoc(e.target.value)}><option value="">All SPOCs</option>{data.spocs.map(s => <option key={id(s.employee)} value={id(s.employee)}>{name(s.employee)}</option>)}</select></label></div>
 {days.map(day => {
        const ordered = [...people].sort((a, b) => Number(b.daily.find(d => d.date === day)?.saved) - Number(a.daily.find(d => d.date === day)?.saved)),
          rows = data.entries.filter(e => e.date && data.days.includes(day) && people.some(s => id(s.employee) === id(e.employee)) && dayOf(e.date) === day);
        return <section key={day}><h3>{dateText(day)}{day === data.today ? ' · today' : ''}</h3><p>{ordered.filter(s => s.daily.find(d => d.date === day)?.saved).length} of {people.length} SPOCs logged · {num(rows.reduce((s, e) => s + e.totalHours, 0))} man-hours</p>{ordered.map(s => {
            const d = s.daily.find(d => d.date === day),
              entries = rows.filter(e => id(e.employee) === id(s.employee));
            return <article className="dm-day" key={id(s.employee)}><div className="dm-day-head"><button className="dm-link" onClick={() => onSpoc(id(s.employee), 'updates')}>{name(s.employee)}</button><span>{num(d?.hours)} h · <strong className={'dm-' + tone(d?.status)}>{d?.status}</strong>{d?.hours > 8 ? ` (+${num(d.hours - 8)} h)` : d?.hours > 0 && d.hours < 8 ? ` (${num(8 - d.hours)} h short)` : ''}</span></div>{d?.saved && <><small>{s.employee.designation || 'Designation not in records'} · Saved at {dateText(d.savedAt, true)}</small><DayBar entries={entries} /><Logs entries={entries} onProject={onProject} /></>}</article>;
          })}</section>;
      })}</Panel></section>;
}
function Followups({
  items,
  canEdit,
  onRefresh,
  onProject,
  projects
}) {
  const mutation = useMutation({
    mutationFn: item => api('/followups/' + item.source + '/' + encodeURIComponent(item.id), 'PATCH', {
      closed: true
    }),
    onSuccess: onRefresh
  });
  const groups = ['RFIs and clarifications', 'Client architect and PMC follow-ups', 'Drawing submissions and revisions', 'Approvals and action items'];
  return <><ErrorBox error={mutation.error} />{groups.map(group => <Panel key={group} title={group}>{items.filter(r => r.group === group).length ? items.filter(r => r.group === group).map(r => <div className="dm-followup" key={r.source + ':' + r.id}><strong>{r.item}</strong><ProjectLink project={projects.find(p => id(p) === r.project) ?? {
          _id: r.project
        }} onOpen={onProject} /><span>{r.responsible || 'Responsible person not in records'}</span><span className={!r.closed && r.due && new Date(r.due) < new Date() ? 'dm-danger' : ''}>Next follow-up: {dateText(r.due)}</span>{r.closed ? <span>Closed</span> : canEdit && <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate(r)}>Mark closed</button>}</div>) : <p>No saved items in this group.</p>}</Panel>)}</>;
}
function eventText(event, people) {
  const d = event.detail ?? {};
  const person = value => people.find(p => id(p.employee) === id(value));
  if (typeof d === 'string') return d;
  if (d.text) return d.text;
  if (event.action === 'SPOC daily work update saved') return `${dateText(d.date)} · ${d.project} · ${d.service} · ${num(d.totalHours)} h\n${(d.areas ?? []).map(a => `${a.key}: ${a.update || 'No remark in records'} (${num(a.hours)} h)`).join('\n')}`;
  if (event.action === 'Project assigned' || event.action === 'Project reassigned') return `${d.previous ? name(person(d.previous)?.employee) : 'No previous SPOC'} → ${name(person(d.updated)?.employee)}${d.reason ? ' · ' + d.reason : ''}`;
  if (event.action === 'Workflow step changed') return `Step ${d.n}: ${d.previous?.status || 'Not Started'} → ${d.updated.status}${d.updated.remarks ? ' · ' + d.updated.remarks : ''}`;
  if (event.action === 'Project status changed') return `${d.previous} → ${d.updated}${d.reason ? ' · ' + d.reason : ''}`;
  return d.item || d.title || 'Recorded management action';
}
function Timeline({
  events,
  onProject,
  projects,
  people = []
}) {
  return events.length ? <ol className="dm-timeline">{events.map(e => <li key={e.source + ':' + id(e)}><strong>{e.action}</strong> · {e.actorName || 'Actor not in records'} · {dateText(e.at, true)}{e.project && <div><ProjectLink project={projects.find(p => id(p) === id(e.project)) ?? {
          _id: e.project
        }} onOpen={onProject} /></div>}<p>{eventText(e, people)}</p></li>)}</ol> : <p>No recorded activity yet.</p>;
}
function SpocDetail({
  selection,
  onClose,
  data,
  onProject,
  onAssign,
  onRefresh
}) {
  const [tab, setTab] = useState(selection.tab || 'overview'),
    [remark, setRemark] = useState('');
  const q = useQuery({
    queryKey: ['design-team-spoc', selection.id],
    queryFn: () => api('/spocs/' + selection.id),
    refetchInterval: 10000
  });
  const add = useMutation({
    mutationFn: () => api('/remarks', 'POST', {
      spoc: selection.id,
      text: remark
    }),
    onSuccess: () => {
      setRemark('');
      onRefresh();
    }
  });
  const mom = useMutation({
    mutationFn: m => api('/meetings/' + id(m) + '/mom', 'PATCH', {}),
    onSuccess: onRefresh
  });
  if (q.isLoading) return <Dialog title="SPOC details" onClose={onClose}><p>Loading saved records…</p></Dialog>;
  if (q.isError) return <Dialog title="SPOC details" onClose={onClose}><ErrorBox error={q.error} retry={() => q.refetch()} /></Dialog>;
  const s = q.data,
    open = s.projects.filter(p => statusOf(p) !== 'Completed'),
    delayed = s.counts.Delayed,
    delay = open.length ? Math.round(delayed / open.length * 100) : 0,
    teamAvg = data.spocs.length ? data.spocs.reduce((v, p) => v + p.load, 0) / data.spocs.length : 0;
  const tabs = [['overview', 'Overview'], ['projects', 'Assigned Projects'], ['updates', 'Daily Work Updates'], ['workload', 'Workload'], ['followups', 'Coordination & Follow-ups'], ['meetings', 'Meetings & MOM'], ['activity', 'Activity Logs'], ['allocations', 'Allocation History']].map(([key, label]) => ({
    key,
    label
  }));
  return <Dialog title={name(s.employee)} onClose={onClose}><p>{s.employee.designation || 'Designation not in records'} · {s.employee.empId || 'Employee ID not in records'}</p><Tabs tabs={tabs} active={tab} onChange={setTab} />
 {tab === 'overview' && <><Panel title="Profile"><dl className="dm-profile">{[['Employee ID', s.employee.empId], ['Designation', s.employee.designation], ['Service', s.employee.department], ['Phone', s.employee.mobile || s.employee.phone], ['Email', s.employee.email], ['Last update', dateText(s.lastUpdate)]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || 'Not in records'}</dd></div>)}</dl></Panel><Panel title="Performance in context"><Load person={s} capacity={s.policy.capacity} /><p>{open.length} open projects · {open.filter(p => p.complexity === 'High').length} high-complexity · {delay}% delayed · {s.pendingFollowups} pending follow-ups</p><p>{delayed ? s.band === 'Heavy' ? 'Delays with a heavy load suggest reviewing the balance of work.' : 'Delays with a light or balanced load suggest reviewing follow-ups and coordination.' : 'No delayed projects are recorded. Workload and follow-ups provide context; project count alone is not a performance score.'}</p></Panel><Counts counts={s.counts} /><Panel title="Remarks from Design Management Head">{s.remarks.map(r => <p key={id(r)}><strong>{r.actorName}</strong> · {dateText(r.at, true)}<br />{r.text}</p>)}{s.canEdit && <form onSubmit={e => {
          e.preventDefault();
          add.mutate();
        }}><label>Remark<textarea aria-label="Design Management Head remark" value={remark} onChange={e => setRemark(e.target.value)} required maxLength={4000} /></label><ErrorBox error={add.error} /><button type="submit" disabled={add.isPending || !remark.trim()}>Save remark</button></form>}</Panel></>}
 {tab === 'projects' && <ProjectRows projects={s.projects} onProject={onProject} onAssign={onAssign} canEdit={s.canEdit} onRefresh={onRefresh} />}
 {tab === 'updates' && <><DailyStrip person={s} today={s.today} onOpen={() => {}} /><p>{num(s.totalHours)} h · {s.daily.filter(d => d.saved).length} days with an entry · average {num(s.totalHours / Math.max(1, s.daily.filter(d => d.saved).length))} h per logged day</p><HourGroups entries={s.entries} /><Logs entries={s.entries} onProject={onProject} /></>}
 {tab === 'workload' && <><Load person={s} capacity={s.policy.capacity} /><p>Team average {num(teamAvg)} pts. Unknown complexity uses 2 points; On Hold uses half; Completed uses zero.</p>{statuses.map(status => <div className="dm-load-label" key={status}><span>{status}</span><strong>{s.counts[status]}</strong><progress aria-label={status+' project count'} max={Math.max(1,s.counts.Total)} value={s.counts[status]} /></div>)}{['High', 'Medium', 'Low'].map(c => <p key={c}>{c} complexity: {open.filter(p => p.complexity === c).length}</p>)}<p>Complexity not in records: {open.filter(p => !p.complexity).length}</p></>}
 {tab === 'followups' && <Followups items={s.followups} canEdit={s.canEdit} onRefresh={onRefresh} onProject={onProject} projects={data.projects} />}
 {tab === 'meetings' && <><ErrorBox error={mom.error} />{['Upcoming meetings', 'Past meetings'].map((title, i) => <Panel key={title} title={title}>{s.meetings.filter(m => i ? new Date(m.date) <= new Date() : new Date(m.date) > new Date()).map(m => <article className="dm-followup" key={id(m)}><strong>{m.title}</strong><span>{dateText(m.date, true)} · {m.status}</span><span>{m.momCirculatedAt ? 'MOM circulated' : 'MOM pending'}</span>{m.mom?.discussion && <p>{m.mom.discussion}</p>}{i === 1 && s.canEdit && m.status === 'Held' && !m.momCirculatedAt && <button disabled={mom.isPending} onClick={() => mom.mutate(m)}>Mark MOM circulated</button>}</article>)}</Panel>)}</>}
 {tab === 'activity' && <Timeline events={s.activity ?? s.events} onProject={onProject} projects={data.projects} people={data.spocs} />}
 {tab === 'allocations' && <Timeline events={s.allocations} onProject={onProject} projects={data.projects} people={data.spocs} />}
 </Dialog>;
}
function DailyStrip({
  person,
  today,
  onOpen
}) {
  return <div className="dm-daily-strip">{person.daily.map(d => <button type="button" key={d.date} className={'dm-day-chip dm-' + tone(d.status) + (d.date === today && !d.saved ? ' pending' : '')} onClick={onOpen} title={dateText(d.date) + ' · ' + d.status}><small>{dateText(d.date).split(' ').slice(0, 2).join(' ')}</small><strong>{d.saved ? num(d.hours) + ' h' : d.status}</strong></button>)}<p>Today: {person.daily.find(d => d.date === today)?.status || 'Not a dashboard working day'} · {person.daily.filter(d => d.status === 'No entry').length} missed days</p></div>;
}
function HourGroups({
  entries
}) {
  const areas = new Map(),
    projects = new Map();
  for (const e of entries) {
    projects.set(projectName(e.project), (projects.get(projectName(e.project)) || 0) + e.totalHours);
    for (const a of e.areas ?? []) areas.set(a.key, (areas.get(a.key) || 0) + a.hours);
  }
  return <div className="dm-grid"><Panel title="Hours by work area">{[...areas].map(([k, v]) => <p key={k}>{k}: {num(v)} h</p>)}</Panel><Panel title="Hours by project">{[...projects].map(([k, v]) => <p key={k}>{k}: {num(v)} h</p>)}</Panel></div>;
}
function ProjectRows({
  projects,
  onProject,
  onAssign,
  canEdit,
  onRefresh
}) {
  const mutation = useMutation({
    mutationFn: ({
      project,
      status,
      reason
    }) => api('/projects/' + id(project) + '/status', 'PATCH', {
      status,
      reason
    }),
    onSuccess: onRefresh
  });
  return <><ErrorBox error={mutation.error} /><div className="dm-table"><table><thead><tr>{['Job number and project', 'Client', 'Stage', 'Status', 'Target date', 'Complexity', 'Actions'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{projects.map(p => <tr key={id(p)}><td><ProjectLink project={p} onOpen={onProject} /></td><td>{p.clientName || p.contacts?.client?.name || 'Not in records'}</td><td>{p.currentStage || 'Not in records'}</td><td><span className={'dm-' + tone(statusOf(p))}>{statusOf(p)}</span></td><td>{dateText(p.expectedCompletion)}</td><td>{p.complexity || 'Not in records (2 pts)'}</td><td>{canEdit && <><button onClick={() => onAssign(null, id(p))}>Reassign</button><select aria-label={'Change status ' + projectName(p)} value={statusOf(p)} disabled={mutation.isPending} onChange={e => {
                  const status = e.target.value;
                  if (status === 'On Hold') {
                    const reason = window.prompt('Reason for placing the project on hold');
                    if (!reason?.trim()) return;
                    mutation.mutate({
                      project: p,
                      status,
                      reason
                    });
                  } else mutation.mutate({
                    project: p,
                    status
                  });
                }}>{statuses.map(s => <option key={s}>{s}</option>)}</select></>}</td></tr>)}</tbody></table>{!projects.length && <p>No assigned projects in records.</p>}</div></>;
}
function ProjectDetail({
  projectId,
  onClose,
  onAssign,
  onRefresh,
  data
}) {
  const q = useQuery({
    queryKey: ['design-team-project', projectId],
    queryFn: () => api('/projects/' + projectId),
    refetchInterval: 10000
  });
  const mutation = useMutation({
    mutationFn: step => api('/projects/' + projectId + '/workflow', 'PATCH', step),
    onSuccess: onRefresh
  });
  return <Dialog title="Project record" onClose={onClose}><ErrorBox error={q.error} retry={() => q.refetch()} />{q.data && <><h3>{projectName(q.data.project)}</h3><p>Client: {q.data.project.clientName || q.data.project.contacts?.client?.name || 'Not in records'} · Architect: {q.data.project.contacts?.architect?.name || 'Not in records'} · PMC: {q.data.project.contacts?.pmc?.name || 'Not in records'}</p><p>Project Director: {q.data.project.related?.projectDirector || 'Not in records'} · {statusOf(q.data.project)} · {q.data.project.complexity || 'Complexity not in records'} · Target {dateText(q.data.project.expectedCompletion)}</p><div className="dm-stages">{['CD', 'SD', 'DD', 'TD', 'GFC'].map(s => <span key={s} className={s === q.data.project.currentStage ? 'current' : ''}>{s}</span>)}</div>{q.data.loggedOutsideAllocation && <p>This is saved work outside the current allocation. Management actions are unavailable.</p>}<p>Assigned service teams: {(q.data.teams ?? []).map(t => t.name + ' (' + t.service + ')').join(', ') || 'Not in records'}</p>{q.data.canEdit && <button onClick={() => onAssign(null, projectId)}>Assign or reassign SPOC</button>}<Panel title="SPOC man-hours in the last 7 working days"><p>{num(q.data.hours)} hours</p><Panel title="Hours by SPOC">{data.spocs.map(s => ({
            person: s.employee,
            hours: q.data.entries.filter(e => id(e.employee) === id(s.employee)).reduce((v, e) => v + e.totalHours, 0)
          })).filter(s => s.hours > 0).map(s => <p key={id(s.person)}>{name(s.person)}: {num(s.hours)} h</p>)}</Panel><HourGroups entries={q.data.entries} /><Logs entries={q.data.entries} onProject={undefined} /></Panel><Followups items={q.data.followups} canEdit={q.data.canEdit} onRefresh={onRefresh} onProject={undefined} projects={[q.data.project]} /><Panel title="Allocation history"><Timeline events={q.data.allocations} onProject={undefined} projects={data.projects} people={data.spocs} /></Panel><Panel title="SPOC Head coordination workflow"><p>{q.data.workflow.steps.filter(s => s.status === 'Completed').length} of 16 steps completed · Last entry {dateText(q.data.workflow.updatedAt)}</p><progress aria-label="Coordination workflow completed steps" max={16} value={q.data.workflow.steps.filter(s => s.status === 'Completed').length} /><ErrorBox error={mutation.error} />{q.data.workflow.steps.map(step => <WorkflowStep key={step.n} step={step} now={q.data.asOf} canEdit={q.data.canEdit} pending={mutation.isPending} save={value => mutation.mutate(value)} />)}</Panel></>}</Dialog>;
}
function WorkflowStep({
  step,
  canEdit,
  pending,
  save,
  now
}) {
  const [status, setStatus] = useState(step.status),
    [remarks, setRemarks] = useState(step.remarks || '');
  const stale = step.status === 'In Progress' && step.date && new Date(now) - new Date(step.date) > 30 * 86400000;
  return <form className="dm-workflow" onSubmit={e => {
    e.preventDefault();
    save({
      n: step.n,
      status,
      remarks
    });
  }}><h4>{step.n}. {step.label}</h4><p>{step.owner} · Last changed {dateText(step.date)} {stale && <strong className="dm-danger">No update for over 30 days</strong>}</p><label>Status<select aria-label={'Step ' + step.n + ' status'} value={status} disabled={!canEdit || pending} onChange={e => setStatus(e.target.value)}>{['Not Started', 'In Progress', 'Completed', ...(step.status === 'Blocked' ? ['Blocked'] : [])].map(s => <option key={s}>{s}</option>)}</select></label><label>Input and remarks<textarea aria-label={'Step ' + step.n + ' remarks'} value={remarks} disabled={!canEdit || pending} onChange={e => setRemarks(e.target.value)} maxLength={4000} /></label>{canEdit && <button type="submit" disabled={pending || status === 'Blocked'}>Save step {step.n}</button>}</form>;
}
function AssignDialog({
  target,
  onClose,
  data,
  onRefresh
}) {
  const initial = target.project ? data.projects.find(p => id(p) === target.project) : null;
  const [project, setProject] = useState(initial),
    [spoc, setSpoc] = useState(target.spoc || ''),
    [reason, setReason] = useState(''),
    [search, setSearch] = useState(''),
    [review, setReview] = useState(false);
  const projectInfo = useQuery({
    queryKey: ['design-team-project', id(project)],
    queryFn: () => api('/projects/' + id(project)),
    enabled: !!project
  });
  const mutation = useMutation({
    mutationFn: () => api('/projects/' + id(project) + '/assign', 'POST', {
      spoc,
      expectedSpoc: project.currentSpoc ?? null,
      reason
    }),
    onSuccess: () => {
      onRefresh();
      onClose();
    }
  });
  const projects = data.projects.filter(p => (!target.spoc || p.currentSpoc !== target.spoc) && projectName(p).toLowerCase().includes(search.toLowerCase()) && p.status !== 'Completed' && !p.allocationAmbiguous);
  const options = data.spocs.map(s => {
    const match = serviceNames([s.employee.department]).some(service => serviceNames(project?.services ?? []).includes(service)),
      after = s.load + (project ? point(project) : 0);
    return {
      ...s,
      match,
      after
    };
  });
  const suggested = [...options].filter(s => s.match && s.after <= data.policy.capacity && id(s.employee) !== project?.currentSpoc).sort((a, b) => a.load - b.load || name(a.employee).localeCompare(name(b.employee)))[0];
  const selected = options.find(s => id(s.employee) === spoc),
    current = data.spocs.find(s => id(s.employee) === project?.currentSpoc);
  return <Dialog title="Assign or reassign project" onClose={onClose}><ErrorBox error={mutation.error} />{review ? <><h3>Review assignment</h3><p>{projectName(project)}</p><p>{name(current?.employee)} → {name(selected?.employee)}</p><p>Load {num(selected?.load)} → {num(selected?.after)} / {data.policy.capacity} pts</p><p>Reason: {reason || 'First assignment; no reason entered'}</p><p>Admin activation and billing approvals retain their existing workflow.</p><button disabled={mutation.isPending} onClick={() => setReview(false)}>Back</button><button disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Saving…' : project.currentSpoc ? 'Confirm reassignment' : 'Confirm assignment'}</button></> : <form onSubmit={e => {
      e.preventDefault();
      setReview(true);
    }}><label>Search projects<input value={search} onChange={e => setSearch(e.target.value)} /></label><label>Project<select required aria-label="Allocation project" value={project ? id(project) : ''} onChange={e => {
          setProject(data.projects.find(p => id(p) === e.target.value));
          setSpoc(target.spoc || '');
          setReason('');
        }}><option value="">Choose an authorised project</option>{projects.map(p => <option key={id(p)} value={id(p)}>{projectName(p)} · {name(data.spocs.find(s => id(s.employee) === p.currentSpoc)?.employee)}{!p.currentSpoc ? ' (no SPOC)' : ''}</option>)}</select></label>{project && <Panel title="Project details"><p>{projectName(project)} · {project.clientName || project.contacts?.client?.name || 'Client not in records'}</p><p>Architect: {project.contacts?.architect?.name || 'Not in records'} · PMC: {project.contacts?.pmc?.name || 'Not in records'}</p><p>Project Director: {project.related?.projectDirector || 'Not in records'} · Services {serviceNames(project.services).join(', ') || 'Not in records'}</p><p>Stage {project.currentStage || 'Not in records'} · Status {statusOf(project)} · Target {dateText(project.expectedCompletion)} · Complexity {project.complexity || 'Not in records (2 pts)'}</p><p>Assigned service teams: {(projectInfo.data?.teams ?? []).map(t => t.name + ' (' + t.service + ')').join(', ') || 'Not in records'}</p><div className="dm-stages">{['CD', 'SD', 'DD', 'TD', 'GFC'].map(stage => <span key={stage} className={stage === project.currentStage ? 'current' : ''}>{stage}</span>)}</div><p>Current SPOC: {current ? name(current.employee) : project.currentSpoc ? 'Outside your reporting line' : 'No SPOC'}{current ? ` · ${num(current.load)} pts` : ''}</p></Panel>}<label>Choose SPOC<select required aria-label="New SPOC" value={spoc} onChange={e => setSpoc(e.target.value)}><option value="">Choose a SPOC in your reporting line</option>{options.map(s => <option key={id(s.employee)} value={id(s.employee)} disabled={id(s.employee) === project?.currentSpoc}>{name(s.employee)} · {s.employee.department || 'Service not in records'} · Active {s.counts.Active}, delayed {s.counts.Delayed} · {num(s.load)} → {num(s.after)} pts{id(s.employee) === project?.currentSpoc ? ' · Current SPOC' : id(s.employee) === id(suggested?.employee) ? ' · Suggested' : ''}{s.match ? ' · Service match' : ''}{s.after > data.policy.capacity ? ' · Over capacity' : ''}</option>)}</select></label><label>Reason {project?.currentSpoc ? '(required for reassignment)' : '(optional for first assignment)'}<textarea value={reason} onChange={e => setReason(e.target.value)} required={!!project?.currentSpoc} maxLength={4000} /></label><button type="submit" disabled={!project || !spoc || spoc === project.currentSpoc}>Review assignment</button></form>}</Dialog>;
}
export default function DesignTeamPage() {
  const qc = useQueryClient(),
    [search, setSearch] = useState(''),
    [service, setService] = useState(''),
    [status, setStatus] = useState(''),
    [workload, setWorkload] = useState(''),
    [sort, setSort] = useState('name'),
    [spoc, setSpoc] = useState(null),
    [project, setProject] = useState(null),
    [assignment, setAssignment] = useState(null);
  const q = useQuery({
    queryKey: ['design-team'],
    queryFn: () => api(),
    refetchInterval: 10000
  });
  const refresh = useCallback(() => {
    for (const key of ['design-team', 'design-team-spoc', 'design-team-project', 'projects', 'spoc-allocations', 'spoc-assigned-projects']) qc.invalidateQueries({
      queryKey: [key]
    });
  }, [qc]);
  const closeSpoc = useCallback(() => setSpoc(null), []),
    closeProject = useCallback(() => setProject(null), []),
    closeAssignment = useCallback(() => setAssignment(null), []);
  function openProject(value) {
    setSpoc(null);
    setProject(value);
  }
  function openAssign(person, projectId) {
    setSpoc(null);
    setProject(null);
    setAssignment({
      spoc: person,
      project: projectId
    });
  }
  function openSpoc(value, tab = 'overview') {
    setSpoc({
      id: value,
      tab
    });
  }
  if (q.isLoading) return <p>Loading saved SPOC daily work and management records…</p>;
  if (q.isError) return <ErrorBox error={q.error} retry={() => q.refetch()} />;
  const data = q.data,
    services = [...new Set(data.spocs.flatMap(s => serviceNames([s.employee.department, ...s.projects.flatMap(p => p.services ?? [])])))].sort();
  const shown = data.spocs.filter(s => (!service || serviceNames([s.employee.department, ...s.projects.flatMap(p => p.services ?? [])]).includes(service)) && (!status || s.projects.some(p => statusOf(p) === status)) && (!workload || s.band === workload) && [name(s.employee), s.employee.empId, s.employee.designation, s.employee.department, ...s.projects.map(projectName)].join(' ').toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort === 'load' ? b.load - a.load : sort === 'delayed' ? b.counts.Delayed - a.counts.Delayed : sort === 'oldest' ? new Date(a.lastUpdate || 0) - new Date(b.lastUpdate || 0) : name(a.employee).localeCompare(name(b.employee)));
  return <section className="dm-page"><div className="page-head"><h1 className="page-title">My Team</h1><p className="page-sub">SPOCs reporting to you: projects, saved daily work, man-hours and coordination.</p></div><div className="dm-summary">{[['SPOCs', data.summary.spocs], ['Assigned projects', data.summary.assigned], ['Active', data.summary.active], ['Delayed', data.summary.delayed], ['Awaiting info', data.summary.awaiting], ['Ready for billing', data.summary.ready], ['Without a SPOC', data.summary.withoutSpoc], ['Today’s daily updates', data.summary.todayUpdated + ' / ' + data.summary.spocs], ['Man-hours 7 working days', num(data.summary.hours)]].map(([k, v]) => <div key={k} className={(k === 'Delayed' || k === 'Without a SPOC') && v || k === 'Today’s daily updates' && data.summary.todayWorking && data.summary.todayUpdated < data.summary.spocs ? 'dm-danger' : ''}><span>{k}</span><strong>{v}</strong></div>)}</div>
 {data.unassigned.length > 0 && <Panel title="Projects without a SPOC">{data.unassigned.map(p => <p key={id(p)}><ProjectLink project={p} onOpen={openProject} /> · {p.currentStage || 'Stage not in records'} · {p.complexity || 'Complexity not in records'} {data.canEdit && <button onClick={() => openAssign(null, id(p))}>Assign SPOC</button>}</p>)}</Panel>}
 <div className="dm-filters"><label>Search SPOCs<input aria-label="Search SPOCs" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, employee ID, service, project or job number" /></label><label>Service<select value={service} onChange={e => setService(e.target.value)}><option value="">Any service</option>{services.map(s => <option key={s}>{s}</option>)}</select></label><label>Project status<select value={status} onChange={e => setStatus(e.target.value)}><option value="">Any project status</option>{statuses.map(s => <option key={s}>{s}</option>)}</select></label><label>Workload<select value={workload} onChange={e => setWorkload(e.target.value)}><option value="">Any workload</option>{['Light', 'Balanced', 'Heavy'].map(s => <option key={s}>{s}</option>)}</select></label><label>Sort<select value={sort} onChange={e => setSort(e.target.value)}><option value="name">Name</option><option value="load">Heaviest workload</option><option value="delayed">Most delayed</option><option value="oldest">Oldest update</option></select></label></div><p aria-live="polite">{shown.length} of {data.spocs.length} SPOCs · <a href="#dmh-man-hour-register">Jump to Man-hour register</a></p>
 {!data.spocs.length && <Panel title="No reporting SPOCs in records"><p>No active Coordinator logins are linked to your saved reporting line. An authorised administrator must verify those existing employee links. The dashboard does not create or guess reporting relationships.</p></Panel>}
 {data.spocs.length > 0 && !shown.length && <p>No SPOCs match these filters.</p>}
 <div className="dm-grid">{shown.map(s => <article className="dm-card" key={id(s.employee)}><span className="dm-avatar" aria-hidden="true">{name(s.employee).split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase()}</span><button className="dm-card-name dm-link" onClick={() => openSpoc(id(s.employee))}>{name(s.employee)}</button><p>{s.employee.designation || 'Designation not in records'} · {s.employee.department || 'Service not in records'} · {s.employee.empId || 'Employee ID not in records'}</p><p>{s.employee.mobile || s.employee.phone || 'Phone not in records'}<br />{s.employee.email || 'Email not in records'}</p><Load person={s} capacity={data.policy.capacity} /><Counts counts={s.counts} /><DailyStrip person={s} today={data.today} onOpen={() => openSpoc(id(s.employee), 'updates')} /><div>{s.projects.filter(p => statusOf(p) !== 'Completed').slice(0, 3).map(p => <p key={id(p)}><ProjectLink project={p} onOpen={openProject} /> <span>{p.currentStage || 'Stage not in records'} · <strong className={'dm-' + tone(statusOf(p))}>{statusOf(p)}</strong></span></p>)}{s.projects.filter(p => statusOf(p) !== 'Completed').length > 3 && <button className="dm-link" onClick={() => openSpoc(id(s.employee), 'projects')}>+{s.projects.filter(p => statusOf(p) !== 'Completed').length - 3} more</button>}</div><footer><span className={s.lastUpdate && new Date(data.asOf) - new Date(s.lastUpdate) > 21 * 86400000 ? 'dm-danger' : ''}>Last update {dateText(s.lastUpdate)}{s.lastUpdate ? ' · ' + Math.floor((new Date(data.asOf) - new Date(s.lastUpdate)) / 86400000) + ' days ago' : ''}</span>{data.canEdit && <button onClick={() => openAssign(id(s.employee))}>Assign</button>}<button onClick={() => openSpoc(id(s.employee))}>View details</button></footer></article>)}</div>
 <Register data={data} onProject={openProject} onSpoc={openSpoc} /><p className="dm-policy">Dashboard calendar: {data.policy.calendar}. Standard day: {data.policy.standardHours} h. Hours from saved entries are retained; no sample employee or project is generated.</p>
 {spoc && <SpocDetail key={spoc.id} selection={spoc} onClose={closeSpoc} data={data} onProject={openProject} onAssign={openAssign} onRefresh={refresh} />}{project && <ProjectDetail key={project} projectId={project} onClose={closeProject} onAssign={openAssign} data={data} onRefresh={refresh} />}{assignment && <AssignDialog target={assignment} onClose={closeAssignment} data={data} onRefresh={refresh} />}
 </section>;
}
