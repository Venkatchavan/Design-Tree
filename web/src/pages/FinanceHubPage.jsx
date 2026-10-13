import { useState } from 'react';
import Tabs from '../components/Tabs.jsx';
import FinanceOccPage from './FinanceOccPage.jsx';
import RevenueReportsPage from './RevenueReportsPage.jsx';

// Finance hub — single sidebar entry ("Finance") for FD / WD / ED / finance.
// OCC and Revenue live here as inner sub-tabs; both children stay fully
// server-driven (no dummy / hardcoded data), reusing their pages as-is.
const HUB_TABS = [
  { key: 'occ', label: 'Finance Operation Control Center (OCC)' },
  { key: 'revenue', label: 'Revenue & Financial Reports' },
];

export default function FinanceHubPage({ bootstrap, user, viewKey }) {
  const [tab, setTab] = useState('occ');

  return (
    <div id="view-finance-hub">
      <div className="page-head">
        <div className="page-title">Finance</div>
        <div className="page-sub">Finance operations and revenue reports in one place.</div>
      </div>
      <Tabs tabs={HUB_TABS} active={tab} onChange={setTab} />
      {tab === 'occ' ? (
        <FinanceOccPage bootstrap={bootstrap} user={user} viewKey={viewKey} />
      ) : (
        <RevenueReportsPage />
      )}
    </div>
  );
}
