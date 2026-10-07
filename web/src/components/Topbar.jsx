import { Search } from 'lucide-react';
import NotifBell from './NotifBell.jsx';

export default function Topbar({ crumbs }) {
  return (
    <div className="topbar">
      <div className="breadcrumb">
        {crumbs.map((c, i) => (
          <span key={i}>
            {i > 0 && <span> / </span>}
            {i === crumbs.length - 1 ? <b>{c}</b> : c}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="search">
          <Search size={14} />
          <span>Search projects</span>
        </div>
        <NotifBell />
      </div>
    </div>
  );
}
