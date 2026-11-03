import DtPeerReview from '../components/DtPeerReview.jsx';

// Left-nav "DT Peer Review" for Peer Review logins; they maintain the package.
export default function DtPeerReviewPage({ bootstrap }) {
  const role = bootstrap?.role?.key ?? '';
  return <DtPeerReview canEdit={['peer_reviewer', 'peer_review_head'].includes(role)} />;
}
