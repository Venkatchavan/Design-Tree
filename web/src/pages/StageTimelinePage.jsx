import { Link, useParams } from 'react-router-dom';
import StageTimelinePanel from '../components/StageTimelinePanel.jsx';
export default function StageTimelinePage() {
  const {
    id
  } = useParams();
  return <div><div className="page-head"><div className="page-title">Stage timeline</div><Link to={`/projects/${id}`}>Back to project</Link></div><StageTimelinePanel projectId={id} /></div>;
}
