import { Link, useParams } from 'react-router-dom';
import StageTimelinePanel from '../components/StageTimelinePanel.jsx';
export default function StageTimelinePage({ bootstrap }) {
  const {
    id
  } = useParams();
  const canOpenProject = !['finance','engineer_drafter'].includes(bootstrap?.role?.key);
  const home = bootstrap?.views?.[bootstrap?.home]?.path;
  return <div><div className="page-head"><div className="page-title">Stage timeline</div><Link to={canOpenProject ? `/projects/${id}` : home || "/"}>{canOpenProject ? "Back to project" : "Back to workspace"}</Link></div><StageTimelinePanel projectId={id} /></div>;
}
