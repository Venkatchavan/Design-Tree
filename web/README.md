# DesignTree web — React + Vite SPA

React 19 + Vite frontend for the DesignTree workspace. Plain `.jsx`
(no TypeScript). The app has **no static route/role table**: navigation,
views, home path and policy all come from the api at runtime via
`GET /api/meta/bootstrap` (canonical source: `api/src/config/roles.js`).

## Stack

| Layer | Actual |
|---|---|
| UI | React 19.2 + ReactDOM, `react-router-dom` 7 (`BrowserRouter`) |
| Server state | `@tanstack/react-query` 5 (`QueryClientProvider` in `src/main.jsx`) |
| Realtime | `socket.io-client` 4 (`src/lib/realtime.js`, path `/socket.io/`) |
| UI kit | Hand-rolled components in `src/components/` (`Panel`, `Tabs`, `DataTable`, `KpiCard`, `StatusPill`, `Modal`, `Field`, `EmptyState`) + `lucide-react` icons, IBM Plex fonts in `src/index.css` |
| Charts / Excel | `chart.js` + `react-chartjs-2` (dashboard stage chart), `xlsx` (HR import/export) |
| Transport | `fetch` with `credentials: 'include'` (HttpOnly cookie JWT), base `VITE_API_URL ?? ''` (same-origin `/api` in production) |

## Scripts

```powershell
cd web
npm install
npm run dev      # vite :5173, /api + /socket.io proxied to http://localhost:5000 (see vite.config.js)
npm run build    # production bundle (gateway serves dist/)
npm run preview  # preview the production build locally
npm run lint     # eslint
```

## How routing & auth work

```
BrowserRouter
└─ AuthGate: useQuery(['me'], GET /api/auth/me) → <LoginPage/> when unauthenticated
   └─ ShellRoutes: useQuery(['bootstrap'], GET /api/meta/bootstrap)
      ├─ / → Navigate(home)            # bootstrap.home for this role
      ├─ one <Route> per allowed view   # bootstrap.views[view].path
      ├─ extra routes (non-nav, granted by parent nav):
      │   /projects/:id when dashboard · /projects/new when admin_billing · /teams/:id when teams
      └─ * → Navigate(home)
```

- `src/layout/AppShell.jsx` renders `<Sidebar nav=bootstrap.nav/>` +
  `<Topbar/>` + page content. The sidebar renders `bootstrap.nav` verbatim;
  search appears only when the nav contains `dashboard`.
- Login (`src/pages/LoginPage.jsx`): `POST /api/auth/login
  {email, password}`. Late sign-in (after 09:45 IST on a working day) opens a
  reason modal → `PATCH /api/attendance/reason`.
- Sign-out (`src/components/SignOutButton.jsx`): man-hour-exempt roles
  (`src/lib/session.js`: directive roles + `superuser`/`client`/`architect`)
  log out directly. Everyone else must have today's hours
  (`GET /api/spoc/man-hours/status`) and may need late/early attendance
  reasons before `POST /api/auth/logout` succeeds.

## Role navigation (from `api/src/config/roles.js`)

- Leadership (`founding_director`, `working_director`, `executive_director`):
  Dashboard/Projects, Billing, Certificates, Teams, HR, Work Progress,
  Transmittal Log, Design Mgmt, Marketing, Finance OCC, Travel Booking,
  Revenue Reports, Billing Status, function heads, Leave-Travel, Support,
  Management, My Meetings. FD/WD can access every view via `canAccess`.
- `admin_billing` (home `dashboard`): Dashboard, Projects (+ `new-project`
  route), Billing, Certificates, Teams, **Branches**, **Transmittal (admin)**,
  admin-work-update, Leave-Travel, Support, My Meetings. `PROJECT_CREATORS =
  {'admin_billing'}` gates the New-project button (`src/App.jsx`,
  `src/pages/DashboardPage.jsx`); branch management is admin-only
  (`src/pages/BranchesPage.jsx`).
- `superuser` (home `hr`): HR view only — provisioning account. HR tabs are
  restricted to Employee management + External access.
- `hr` (home `hr`): full 12-tab HR (`src/pages/HRPage.jsx`: Overview, Manage,
  External portal users, Track, Attendance+Leave, Login hours, Travel/Meeting
  logs, Holidays, Support, Recruitment, Reports) + Dashboard/Projects/
  Certificates/Teams/Branches/Transmittal-Log/admin-work-update/Leave/Support.
- Delivery: `team_lead` (my-team + work-progress), `coordinator` (home
  `my-coordination`), `engineer_drafter` (home `my-work`), QS/QA/BIM/GBS/Peer
  (`work-tracking` + update-work-progress), `design_mgmt_head`
  (design-management), `marketing`, `finance` (finance + finance-occ + travel +
  revenue + billing-status).
- External `client` / `architect` (home `/portal`): `ClientPortalPage.jsx`
  only (details/stages/revisions/requests/drawings + acknowledge/certificates).

## API clients (`src/lib/`)

| Module | Covers |
|---|---|
| `api.js` | `meApi`, `projectsApi`, `teamsApi`, `usersApi` (+ `createPortal`), `portalApi`, `workEntriesApi`, multipart helper |
| `spocApi.js` | SPOC allocations/entries, man-hours status |
| `workApi.js` | Tasks, deliverables, revisions, drawings, recruitment |
| `functionsApi.js` | QS/QA/BIM/GBS/peer-review function endpoints |
| `phase3Api.js` | Billing, transmittals (+ xlsx import/export/preview/confirm/undo), certificates, finance OCC |
| `phase4aApi.js` | Leave/travel/allowances/holidays, support, bookings, marketing, design-mgmt |
| `phase4bApi.js` | `meetingsApi` (schedule/update/reschedule/held/cancel, attendance, MOM + download, refdocs, actions, respond, absence-log) |
| `branches.js` | `useBranchOptions` — strict branch dropdown source (branches master) |
| `session.js` | `SUPER_ROLES`, `DIRECTIVE_ROLES`, man-hour/attendance exemption, `entryPathForRole` |
| `realtime.js` | socket.io singleton (`path: '/socket.io/'`, `withCredentials`); `subscribeNotifications` fan-out consumed by `NotifBell.jsx` (60 s REST polling fallback) |
| `meetingsLogic.js` | Meeting display status/tone, alerts, action/attendance filters |

Key pages: `DashboardPage` (stats/filters/stage chart, Topbar project search),
`ProjectDetailPage` (timeline, directory, portal-users, GFC-readiness,
final-approval), `NewProjectPage`, `TeamsPage`/`TeamDetailPage`,
`MyTeamPage`/`MyWorkPage`/`MyCoordinationPage` (+ `meetings/SpocMeetings.jsx`),
`MyMeetingsPage` (+ `MeetingsCommon.jsx`), `BillingPage`/`BillingStatusPage`/
`FinancePage`/`FinanceOccPage`/`RevenueReportsPage`/`TravelBookingPage`,
`CertificatesPage`, `HRPage`, `BranchesPage`, `DeptDashboardPage`,
`DesignMgmtPage`, `MarketingPage`, `ManagementPage`, `FunctionHeadPage`,
`ClientPortalPage`, `LeaveTravelPage`, `EmployeeSupportPage`.

## Config notes

- Dev proxy (`vite.config.js`): `/api → http://localhost:5000`,
  `/socket.io → http://localhost:5000` (ws). Production: same-origin —
  keep `VITE_API_URL` empty so the gateway serves SPA + API on one origin
  (avoids CORS/cookie issues).
- Login selectors relied on by e2e: `#loginEmail`, `#loginPassword`,
  `.login-btn` — do not rename without updating `e2e/helpers/auth-ui.ts`.
