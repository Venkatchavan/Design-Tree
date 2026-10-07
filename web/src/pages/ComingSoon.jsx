import Panel from '../components/Panel.jsx';

// Placeholder for views whose phase hasn't been built yet.
export default function ComingSoon({ title, sub, phase }) {
  return (
    <>
      <div className="page-head">
        <div className="page-title">{title}</div>
        <div className="page-sub">{sub}</div>
      </div>
      <Panel title={title}>
        <p style={{ color: 'var(--ink-muted)', fontSize: 13.5 }}>
          This module arrives in Phase {phase}. The layout, navigation and
          access rules are live; the data tables and forms are not built yet.
        </p>
      </Panel>
    </>
  );
}
