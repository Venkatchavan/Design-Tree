import PeerDashboardPage from './pages/PeerDashboardPage.jsx';
import { lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { bootstrapApi, meApi } from './lib/api.js'
import AppShell from './layout/AppShell.jsx'
import LoginSkeleton from './components/LoginSkeleton.jsx'
import ComingSoon from './pages/ComingSoon.jsx'
import LoginPage from './pages/LoginPage.jsx'
import PublicCertificatePage from './pages/PublicCertificatePage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ProjectDetailPage from './pages/ProjectDetailPage.jsx'
import NewProjectPage from './pages/NewProjectPage.jsx'
import TeamsPage from './pages/TeamsPage.jsx'
import TeamDetailPage from './pages/TeamDetailPage.jsx'
import HRPage from './pages/HRPage.jsx'
import MyTeamPage from './pages/MyTeamPage.jsx'
import QSLogPage from './pages/QSLogPage.jsx'
import MyWorkPage from './pages/MyWorkPage.jsx'
import WorkProgressPage from './pages/WorkProgressPage.jsx'
import UpdateWorkProgressPage from './pages/UpdateWorkProgressPage.jsx'
import AdminWorkUpdatePage from './pages/AdminWorkUpdatePage.jsx'
import MyCoordinationPage from './pages/MyCoordinationPage.jsx'
import MyMeetingsPage from './pages/MyMeetingsPage.jsx'
import WorkTrackingPage from './pages/WorkTrackingPage.jsx'
import TransmittalLogPage from './pages/TransmittalLogPage.jsx'
import AdminTransmittalPage from './pages/AdminTransmittalPage.jsx'
import BillingPage from './pages/BillingPage.jsx'
import CertificatesPage from './pages/CertificatesPage.jsx'
import FinancePage from './pages/FinancePage.jsx'
import FinanceHubPage from './pages/FinanceHubPage.jsx'
import RevenueReportsPage from './pages/RevenueReportsPage.jsx'
import BillingStatusPage from './pages/BillingStatusPage.jsx'
import FinanceOccPage from './pages/FinanceOccPage.jsx'
import DesignMgmtPage from './pages/DesignMgmtPage.jsx'
import MarketingPage from './pages/MarketingPage.jsx'
import ManagementPage from './pages/ManagementPage.jsx'
import FunctionHeadPage from './pages/FunctionHeadPage.jsx'
import DeptDashboardPage from './pages/DeptDashboardPage.jsx'
import ClientPortalPage from './pages/ClientPortalPage.jsx'
import LeaveTravelPage from './pages/LeaveTravelPage.jsx'
import EmployeeSupportPage from './pages/EmployeeSupportPage.jsx'
import BranchesPage from './pages/BranchesPage.jsx'
import OfflineGate from './components/OfflineGate.jsx'
import TravelBookingPage from './pages/TravelBookingPage.jsx'
const StageTimelinePage = lazy(() => import('./pages/StageTimelinePage.jsx'))
const TravelBookingActionPage = lazy(() => import('./pages/TravelBookingActionPage.jsx'))
import AnnouncementsPage from './pages/AnnouncementsPage.jsx'

const VIEW_COMPONENTS = {
  'peer-dashboard': PeerDashboardPage,
  announcements: AnnouncementsPage,
  'announcement-detail': AnnouncementsPage,
  dashboard: DashboardPage,
  'stage-timeline': StageTimelinePage,
  'project-detail': ProjectDetailPage,
  'new-project': NewProjectPage,
  teams: TeamsPage,
  'team-detail': TeamDetailPage,
  hr: HRPage,
  'my-team': MyTeamPage,
  'my-work': MyWorkPage,
  'work-progress': WorkProgressPage,
  'update-work-progress': UpdateWorkProgressPage,
  'admin-work-update': AdminWorkUpdatePage,
  'my-coordination': MyCoordinationPage,
  'my-meetings': MyMeetingsPage,
  meetings: MyMeetingsPage,
  'qs-log': QSLogPage,
  'work-tracking': WorkTrackingPage,
  'transmittal-log': TransmittalLogPage,
  transmittal: AdminTransmittalPage,
  billing: BillingPage,
  certificates: CertificatesPage,
  finance: FinancePage,
  'finance-hub': FinanceHubPage,
  'revenue-reports': RevenueReportsPage,
  'billing-status': BillingStatusPage,
  'finance-occ': FinanceOccPage,
  'design-mgmt': DesignMgmtPage,
  marketing: MarketingPage,
  management: ManagementPage,
  'qaqc-specs': FunctionHeadPage,
  'bim-head': FunctionHeadPage,
  'gbs-head': FunctionHeadPage,
  'peer-review-head': FunctionHeadPage,
  'qs-head': FunctionHeadPage,
  structural: DeptDashboardPage,
  mechanical: DeptDashboardPage,
  electrical: DeptDashboardPage,
  phe: DeptDashboardPage,
  fire: DeptDashboardPage,
  'project-portal': ClientPortalPage,
  'leave-travel': LeaveTravelPage,
  'employee-support': EmployeeSupportPage,
  branches: BranchesPage,
  'travel-booking': TravelBookingPage,
  'travel-booking-new': TravelBookingActionPage,
  'travel-booking-edit': TravelBookingActionPage,
  'travel-booking-reschedule': TravelBookingActionPage,
  'travel-booking-cancel': TravelBookingActionPage,

}

// Non-nav views and the nav view whose presence grants their route.
const EXTRA_ROUTES = [
  { key: 'travel-booking-new', when: 'travel-booking', parent: 'travel-booking' },
  { key: 'travel-booking-edit', when: 'travel-booking', parent: 'travel-booking' },
  { key: 'travel-booking-reschedule', when: 'travel-booking', parent: 'travel-booking' },
  { key: 'travel-booking-cancel', when: 'travel-booking', parent: 'travel-booking' },

  {key:'work-tracking',when:'peer-dashboard',parent:'peer-dashboard'},
  {key:'project-detail',when:'peer-dashboard',parent:'peer-dashboard'},
  { key: 'announcement-detail', when: 'announcements', parent: 'announcements' },
  { key: 'project-detail', when: 'dashboard', parent: 'dashboard' },
  { key: 'new-project', when: 'dashboard', parent: 'dashboard' },
  { key: 'team-detail', when: 'teams', parent: 'teams' },
]

function Splash() {
  return <LoginSkeleton />
}

function ShellPage({ bootstrap, user, viewKey, activeView }) {
  const def = bootstrap.views[viewKey]
  const Cmp = VIEW_COMPONENTS[viewKey]
  return (
    <AppShell
      bootstrap={bootstrap}
      user={user}
      activeView={activeView ?? viewKey}
      crumbs={['DesignTree', def.label]}
    >
      {Cmp ? (
        <Suspense fallback={<p role="status">Loading page…</p>}><Cmp bootstrap={bootstrap} user={user} viewKey={viewKey} /></Suspense>
      ) : (
        <ComingSoon title={def.label} sub={def.sub} phase={def.phase} />
      )}
    </AppShell>
  )
}

// Routes are built ONLY from views the server allows for this role —
// direct-URL probes to anything else fall through to the home page (§2.7).
function ShellRoutes({ user }) {
  const {
    data: bootstrap,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['bootstrap'],
    queryFn: bootstrapApi,
    retry: false,
  })

  if (isLoading) return <Splash />
  if (isError || !bootstrap) return <LoginPage />

  const seen = new Set()
  const allowedViews = bootstrap.nav
    .map((n) => n.view)
    .filter((v) => {
      if (seen.has(v)) return false
      seen.add(v)
      return true
    })
    // Belt-and-braces: Associate/Technical Directors never mount HR, even
    // from a stale or forged bootstrap nav (server canAccess is already false).
    // Technical/Assoc-Technical Directors also never mount design-mgmt or
    // billing-status.
    .filter((v) => {
      if (v === 'hr') {
        return user?.role !== 'associate_director' && user?.role !== 'technical_director'
      }
      if (v === 'design-mgmt' || v === 'billing-status') {
        return user?.role !== 'technical_director' && user?.role !== 'assoc_technical_director'
      }
      return true
    })
  const homePath = bootstrap.views[bootstrap.home].path

  // Only Admin may open the new-project view (matches Dashboard button + API guard).
  const PROJECT_CREATORS = new Set([
    'admin_billing',
  ])
  const extraRoutes = EXTRA_ROUTES.filter(
    ({ key, when }) =>
      bootstrap.views[key] &&
      allowedViews.includes(when) &&
      !seen.has(key) &&
      (key !== 'new-project' || PROJECT_CREATORS.has(user?.role)),
  )

  return (
    <Routes>
      <Route path="/" element={<Navigate to={homePath} replace />} />
      {user?.role === 'design_mgmt_head' && <>
        <Route path="/design-management" element={<Navigate to="/my-team" replace />} />
        <Route path="/teams" element={<Navigate to="/my-team" replace />} />
      </>}
      {['technical_director', 'assoc_technical_director'].includes(user?.role) && (
        <Route path="/teams" element={<Navigate to="/my-team" replace />} />
      )}
      {allowedViews.map((viewKey) => (
        <Route
          key={viewKey}
          path={bootstrap.views[viewKey].path}
          element={
            <ShellPage bootstrap={bootstrap} user={user} viewKey={viewKey} />
          }
        />
      ))}
      {bootstrap.capabilities?.stageTimeline && <Route path={bootstrap.views['stage-timeline'].path} element={<ShellPage bootstrap={bootstrap} user={user} viewKey="stage-timeline" activeView={bootstrap.home} />} />}
      {extraRoutes.map(({ key, parent }) => (
        <Route
          key={key}
          path={bootstrap.views[key].path}
          element={
            <ShellPage
              bootstrap={bootstrap}
              user={user}
              viewKey={key}
              activeView={parent}
            />
          }
        />
      ))}
      <Route path="*" element={<Navigate to={homePath} replace />} />
    </Routes>
  )
}

function AuthGate() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: meApi,
    retry: false,
  })

  if (isLoading) return <Splash />
  if (!isError && data?.user) return <ShellRoutes user={data.user} />
  return <LoginPage />
}

export default function App() {
  return (
    <OfflineGate>
      <BrowserRouter>
        <Routes>
          <Route path="/certificate-request/:token" element={<PublicCertificatePage />} />
          <Route path="*" element={<AuthGate className="app-watermark" />} />
        </Routes>
      </BrowserRouter>
    </OfflineGate>
  )
}
