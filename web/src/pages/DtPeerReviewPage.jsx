import DtPeerReview from '../components/DtPeerReview.jsx';
import { PeerReviewDashboard } from './PeerDashboardPage.jsx';

const PEER_ROLES = ['peer_reviewer', 'peer_review_head'];

// Left-nav "DT Peer Review". What each login can do (allot, work, read) is decided
// by the API; this page only renders it. 27 Nov 2026: the Peer Review dashboard
// sits here too, for the review team, the Admin allotters and Srinivasa Rao
// (view only: no Work Tracking link outside the Peer Review roles).
export default function DtPeerReviewPage({ bootstrap }) {
  const role = bootstrap?.role?.key ?? '';
  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Peer Review dashboard</h1>
      </div>
      <PeerReviewDashboard workTracking={PEER_ROLES.includes(role)} />
      <DtPeerReview />
    </>
  );
}
