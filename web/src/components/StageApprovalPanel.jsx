import { lazy, Suspense } from 'react';
const StageTimelinePanel = lazy(() => import('./StageTimelinePanel.jsx'));
export default function StageApprovalPanel({
  projectId
}) {
  return <Suspense fallback={<p role="status">Loading stage timeline…</p>}><StageTimelinePanel projectId={projectId} /></Suspense>;
}
