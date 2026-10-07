import { useQuery } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { bootstrapApi, meApi } from './lib/api.js'
import AppShell from './layout/AppShell.jsx'
import ComingSoon from './pages/ComingSoon.jsx'
import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ProjectDetailPage from './pages/ProjectDetailPage.jsx'
import NewProjectPage from './pages/NewProjectPage.jsx'
import TeamsPage from './pages/TeamsPage.jsx'
import TeamDetailPage from './pages/TeamDetailPage.jsx'
import HRPage from './pages/HRPage.jsx'
import MyTeamPage from './pages/MyTeamPage.jsx'
import MyWorkPage from './pages/MyWorkPage.jsx'
import WorkProgressPage from './pages/WorkProgressPage.jsx'
import UpdateWorkProgressPage from './pages/UpdateWorkProgressPage.jsx'
import MyCoordinationPage from './pages/MyCoordinationPage.jsx'
import WorkTrackingPage from './pages/WorkTrackingPage.jsx'
import TransmittalLogPage from './pages/TransmittalLogPage.jsx'
import AdminTransmittalPage from './pages/AdminTransmittalPage.jsx'
import BillingPage from './pages/BillingPage.jsx'
import CertificatesPage from './pages/CertificatesPage.jsx'
import FinancePage from './pages/FinancePage.jsx'
import TravelBookingPage from './pages/TravelBookingPage.jsx'
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
import OrgStructurePage from './pages/OrgStructurePage.jsx'

const VIEW_COMPONENTS = {
  dashboard: DashboardPage,
  'project-detail': ProjectDetailPage,
  'new-project': NewProjectPage,
  teams: TeamsPage,
  'team-detail': TeamDetailPage,
  hr: HRPage,
  'my-team': MyTeamPage,
  'my-work': MyWorkPage,
  'work-progress': WorkProgressPage,
  'update-work-progress': UpdateWorkProgressPage,
  'my-coordination': MyCoordinationPage,
  'work-tracking': WorkTrackingPage,
  'transmittal-log': TransmittalLogPage,
  transmittal: AdminTransmittalPage,
  billing: BillingPage,
  certificates: CertificatesPage,
  finance: FinancePage,
  'travel-booking': TravelBookingPage,
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
  'org-structure': OrgStructurePage,
}

// Non-nav views and the nav view whose presence grants their route.
const EXTRA_ROUTES = [
  { key: 'project-detail', when: 'dashboard', parent: 'dashboard' },
  { key: 'new-project', when: 'dashboard', parent: 'dashboard' },
  { key: 'team-detail', when: 'teams', parent: 'teams' },
]

function Splash() {
  return (
    <div className="login-screen">
      <div className="login-sub" style={{ color: '#fff' }}>
        Loading…
      </div>
    </div>
  )
}

function ShellPage({ bootstrap, user, viewKey, activeView }) {
  const def = bootstrap.views[viewKey]
  const Cmp = VIEW_COMPONENTS[viewKey]
  return (
    <AppShell
      bootstrap={bootstrap}
      user={user}
      activeView={activeView ?? viewKey}
      crumbs={['Datum', def.label]}
    >
      {Cmp ? (
        <Cmp bootstrap={bootstrap} user={user} viewKey={viewKey} />
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
  const homePath = bootstrap.views[bootstrap.home].path

  const extraRoutes = EXTRA_ROUTES.filter(
    ({ key, when }) =>
      bootstrap.views[key] && allowedViews.includes(when) && !seen.has(key),
  )

  return (
    <Routes>
      <Route path="/" element={<Navigate to={homePath} replace />} />
      {allowedViews.map((viewKey) => (
        <Route
          key={viewKey}
          path={bootstrap.views[viewKey].path}
          element={
            <ShellPage bootstrap={bootstrap} user={user} viewKey={viewKey} />
          }
        />
      ))}
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
    <BrowserRouter>
      <AuthGate />
    </BrowserRouter>
  )
}
