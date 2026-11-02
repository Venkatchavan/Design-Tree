# Graph Report - Design-Tree  (2026-11-02)

## Corpus Check
- 451 files · ~405,916 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 34 file(s) not represented in the graph (top: .xml 15, (none) 8, .example 4)

## Summary
- 3495 nodes · 9928 edges · 157 communities (139 shown, 18 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 462 edges (avg confidence: 0.85)
- Token cost: 278,531 input · 0 output

## Community Hubs (Navigation)
- App Routes & Panels
- Shared Page Components
- Entry Documents API
- Design Team Panel & Writers
- Stage Approval UI
- Project Import & Services
- Entry Docs & Login Hours UI
- Design Mgmt Workflow API
- Shell & Auth Routing
- Modals & React Query
- Functions & Checklists API
- Reporting Team Pages
- Finance OCC Page
- Teams & Directory API
- E2E Project Fixtures
- App Shell & Toasts
- Express App & Access
- Travel Booking UI
- E2E API Tests
- SPOC Meetings UI
- KPI & Coordination Panels
- Leave/Travel Approval API
- Certificates API
- Meetings API
- Docs & Contact Picker
- Leave & Travel Page
- Deliverables Workflow API
- Salesforce Integration
- Verify Compose Stack
- BLR Roster Import
- E2E Local Servers
- Work Entries & Logout
- My Work Page
- Stage Timeline API
- E2E Browser Checks
- Server Config
- Service Models & GFC
- Attendance Rules
- Finance OCC Models
- Combobox Component
- Design Team Page
- Bookings API
- Meeting Model
- API Dependencies
- Announcements
- Design Head Updates
- My Coordination Page
- Web Tooling Deps
- Dashboard & SPOC API Client
- Container & Spreadsheet E2E
- Approval Flow Config
- Transmittals API
- E2E Package
- Employees API
- Client Update E2E
- Client Portal API
- Reference Dashboard Views
- Roles & Nav Config
- Billing API
- Reports & Drawing Acks
- Marketing API
- Sidebar & Branding
- Meetings Common UI
- Session & Sign-out
- Documents Upload API
- Support Tickets API
- Stakeholder Update Docs
- Shared Travel Booking Logic
- Project Pulse
- Users API
- Finance OCC API
- Service Dashboards API
- Web Runtime Deps
- BLR Account Review Docs
- Deployment Docs
- Nginx Gateway & dbadmin
- Director Teams Page
- Employee Meetings UI
- Announcements Page
- Travel Booking Model
- Variations
- Work Items
- Compose Gateway Service
- E2E TS Config
- Web SPA Entry Docs
- Notification Bell
- Branches API
- Employee Meetings API
- Stage Reviews
- Compose Mongo Dependency
- Client Feedback Nov Docs
- Salesforce Connector Setup
- Employee Select
- Variations Panel
- Register CRUD API
- Compose Networks
- Compose API Service
- Shared Stage Dates
- Compose Certbot Service
- Compose Mongo Service
- Director Updates Docs
- Design Mgmt My Team Doc
- API Gateway & Cookie Auth
- E2E Helpers & Fixtures Docs
- Stakeholder Browser E2E
- Reference Meetings App
- Reference Role Navigation
- Compose Volumes
- Client Update Docs
- Container Security Docs
- Revision Summary
- Meeting Team Utils
- Transmittal Model
- Compose Healthcheck
- Compose Mongo-Express
- Employee PDF Docs
- Dashboard Release Docs
- DMH Browser E2E
- PDF Oct28 E2E
- PDF Oct29 E2E
- Platform Overview Docs
- Notifications API
- Compose Web Build
- Backup & Restore
- PDF Oct27 E2E
- Delivery Flow Overview
- Brand Logo & PWA Icons
- Reporting Team Panel
- Playwright Config
- SPOC Picker E2E
- TL Assignment E2E
- Gateway Entrypoint
- Reference HR Module
- Web Scripts
- SPOC Meetings Nav
- Travel Log API
- Claim Model
- Recruitment Model
- Reference Billing Alerts
- Reference Leave & Travel
- E2E Scorecard
- Reference Pulse View
- Certbot Entrypoint
- Projects By Stage Chart
- Reference Finance View
- Reference Mgmt View
- Reference Work Update
- Reference New Project
- Reference Service Heads
- BLR Import Shell

## God Nodes (most connected - your core abstractions)
1. `Panel()` - 200 edges
2. `DataTable()` - 149 edges
3. `EmptyState()` - 139 edges
4. `StatusPill()` - 116 edges
5. `react` - 77 edges
6. `KpiCard()` - 75 edges
7. `@tanstack/react-query` - 71 edges
8. `mongoose` - 68 edges
9. `Tabs()` - 58 edges
10. `statusTone()` - 50 edges

## Surprising Connections (you probably didn't know these)
- `vite.config.js Dev Proxy (/api, /socket.io -> :5000)` --semantically_similar_to--> `Gateway nginx default.conf (active config dump)`  [INFERRED] [semantically similar]
  web/README.md → nginx-active-config.txt
- `submit()` --indirect_call--> `changes()`  [INFERRED]
  web/src/pages/TravelBookingActionPage.jsx → api/src/utils/projectAudit.js
- `Specs 01-09 (cast creation to GFC approval)` --references--> `npm run seed (superuser provisioning)`  [EXTRACTED]
  e2e/README.md → README.md
- `Same-origin Production (empty VITE_API_URL)` --rationale_for--> `Gateway nginx default.conf (active config dump)`  [INFERRED]
  web/README.md → nginx-active-config.txt
- `submit()` --indirect_call--> `date()`  [INFERRED]
  web/src/components/MeetingsCommon.jsx → web/src/pages/AnnouncementsPage.jsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Director/TL team directory visibility evolution** — docs_client_pdf_20261027_reporting_directory_endpoint, docs_client_pdf_20261027_company_directory_endpoint, docs_director_updates_20261026_saved_ownership_rules, docs_client_pdf_updates_20261029_teams_my_team_consolidation, docs_client_pdf_20261102_td_department_scoped_directory, docs_client_pdf_20261102_project_team_log, docs_client_pdf_20261102_tl_atd_my_team_employee_list [INFERRED 0.85]
- **SPOC eligibility and identity review flow** — docs_spoc_picker_20261027_spoc_options_endpoint, docs_spoc_picker_20261027_project_activate_endpoint, docs_spoc_picker_20261027_hr_review_exclusions, docs_account_login_review_20261027_audit_blr_users_script, docs_account_login_review_20261027_add_blr_users_script, docs_client_pdf_20261102_coordinators_department_option [INFERRED 0.85]
- **Production deployment and operations runbook** — docs_deployment, docs_environment, docs_operations, docs_backup_restore, docs_container_security_update [EXTRACTED 1.00]
- **Gateway routing: SPA, API, socket.io, dbadmin via nginx** — nginx_active_config_gateway_default_conf, nginx_active_config_spa_location, nginx_active_config_api_location, nginx_active_config_socketio_location, nginx_active_config_dbadmin_location, nginx_active_config_login_rate_limit [EXTRACTED 1.00]
- **SPA auth + role bootstrap flow** — web_readme_authgate, web_src_pages_loginpage, web_readme_shellroutes, readme_meta_bootstrap_endpoint, readme_roles_config, readme_cookie_jwt_auth [EXTRACTED 1.00]
- **Salesforce Project__c import pipeline** — salesforce_readme_external_client_app, salesforce_readme_connector, salesforce_readme_field_mapping, salesforce_readme_integration_endpoints, salesforce_readme_salesforce_record_id_index [EXTRACTED 1.00]
- **Meetings feature across the dashboard** — project_reference_datum_dashboard_with_meetings_meetinglog, project_reference_datum_dashboard_with_meetings_mtschedule, project_reference_datum_dashboard_with_meetings_designmeetingslog, project_reference_datum_dashboard_with_meetings_employee_meeting_dashboard, project_reference_datum_dashboard_with_meetings_view_meetingsdash [INFERRED 0.85]
- **Role-gated view navigation** — project_reference_datum_dashboard_with_meetings_showview, project_reference_datum_dashboard_with_meetings_rolecanaccess, project_reference_datum_dashboard_with_meetings_hideallviews, project_reference_datum_dashboard_with_meetings_switchrole, project_reference_datum_dashboard_with_meetings_role_based_view_access [INFERRED 0.85]
- **DesignTree PWA / app icon set derived from logo** — web_public_apple_touch_icon_180x180_icon, web_public_pwa_192x192_icon, web_public_pwa_512x512_icon, web_public_pwa_maskable_512x512_icon, web_public_logo_designtree_brand_mark [INFERRED 0.95]

## Communities (157 total, 18 thin omitted)

### Community 0 - "App Routes & Panels"
Cohesion: 0.04
Nodes (69): EXTRA_ROUTES, VIEW_COMPONENTS, TONES, Tabs(), API_BASE, employeesApi, projectsApi, billingApi (+61 more)

### Community 1 - "Shared Page Components"
Cohesion: 0.06
Nodes (78): DataTable(), EmptyState(), AttendanceReadout(), Panel(), DrawingsPanel(), PeerReviewPanel(), ProjectServiceWorkspace(), ServiceDirectoryPanel() (+70 more)

### Community 2 - "Entry Documents API"
Cohesion: 0.07
Nodes (62): projectDocumentAccess(), attachEntryDocuments(), discardNewUploads(), downloadEntryDocument(), entryDocumentAccess(), entryDocumentsUpload, spocDocumentAccess, workDocumentAccess (+54 more)

### Community 3 - "Design Team Panel & Writers"
Cohesion: 0.05
Nodes (55): COORD_LABELS, COORD_STATUSES, COORDINATION_WRITERS, DASHBOARD_WRITERS, DesignTeamPanel(), startEdit(), SCOPE_STATUSES, WITH_OPTIONS (+47 more)

### Community 4 - "Stage Approval UI"
Cohesion: 0.06
Nodes (64): StageTimelinePage, StageApprovalPanel(), StageTimelinePanel, Approval(), Chip(), COLORS, NAMES, StageTimelinePanel() (+56 more)

### Community 5 - "Project Import & Services"
Cohesion: 0.06
Nodes (62): ALIASES, BUNDLES, PROJECT_SERVICES, HEADER_MAP, importProjects(), mapRow(), parseServices(), uploadSpreadsheet (+54 more)

### Community 6 - "Entry Docs & Login Hours UI"
Cohesion: 0.08
Nodes (47): EntryDocuments(), LoginHoursReport(), AREAS, blank(), editRow(), key(), REVISIONS, SERVICES (+39 more)

### Community 7 - "Design Mgmt Workflow API"
Cohesion: 0.07
Nodes (52): getWorkflow(), saveWorkflow(), withDefaults(), workflowMeta(), addRemark(), allocationMap(), assignProject(), changeStatus() (+44 more)

### Community 8 - "Shell & Auth Routing"
Cohesion: 0.08
Nodes (55): AuthGate(), ShellPage(), ShellRoutes(), Splash(), LoginSkeleton(), boxFaces(), boxPath(), facesD() (+47 more)

### Community 9 - "Modals & React Query"
Cohesion: 0.07
Nodes (45): react, @tanstack/react-query, LocationModal(), Modal(), empName(), fmtDate(), idOf(), contact() (+37 more)

### Community 10 - "Functions & Checklists API"
Cohesion: 0.06
Nodes (54): addChecklistItem(), addComment(), approveWeeklyReport(), areaSettlements, bimWorkOrders, boqItems, byProject(), conveyances (+46 more)

### Community 11 - "Reporting Team Pages"
Cohesion: 0.07
Nodes (50): idOf(), projectMembers(), useReportingTeam(), recruitmentApi, AllocationModal(), AssignWorkPanel(), blankDeliverable(), blankDrawing() (+42 more)

### Community 12 - "Finance OCC Page"
Cohesion: 0.08
Nodes (53): financeOccApi, AC_GROUPS, APPR, buildPO(), buildReimb(), buildTravel(), CATS, checksOf() (+45 more)

### Community 13 - "Teams & Directory API"
Cohesion: 0.08
Nodes (42): DIRECTOR_ROLES, activateProject(), companyDirectory(), createTeam(), getTeam(), listTeams(), myTeams(), reportingDirectory() (+34 more)

### Community 14 - "E2E Project Fixtures"
Cohesion: 0.11
Nodes (32): ACTIONS, BILLING, COORDINATION, LEAVE, MEETING_SUDDEN, MEETING_WEEK1, MOM, PROJECT (+24 more)

### Community 15 - "App Shell & Toasts"
Cohesion: 0.07
Nodes (42): App(), OfflineGate(), Icon(), prefersReducedMotion(), ToastItem(), onPointerDown(), ToastViewport(), useOnlineStatus() (+34 more)

### Community 16 - "Express App & Access"
Cohesion: 0.10
Nodes (36): createApp(), isAllowedOrigin(), canAccess(), isSuperRole(), getRecord, updateRecord(), requireAuth(), denyRoles() (+28 more)

### Community 17 - "Travel Booking UI"
Cohesion: 0.13
Nodes (41): TravelBookingActionPage, bookingsApi, baselineAmount(), bookingStatus(), CANCEL_REASONS, cancellationCost(), day(), hasKnownAmount() (+33 more)

### Community 18 - "E2E API Tests"
Cohesion: 0.09
Nodes (13): cookies, cookies, cookies, startLocalFixture(), cookies, cookies, cookies, cookies (+5 more)

### Community 19 - "SPOC Meetings UI"
Cohesion: 0.12
Nodes (40): ABS_17, ActionItemsTab(), AllMeetingsTab(), AttendanceSection(), AvailabilitySection(), barData(), barOptions(), CHART_COLORS (+32 more)

### Community 20 - "KPI & Coordination Panels"
Cohesion: 0.10
Nodes (40): KpiCard(), CoordinationPanel(), directoryList(), request(), toQuery(), areaApi, bimApi, boqApi (+32 more)

### Community 21 - "Leave/Travel Approval API"
Cohesion: 0.10
Nodes (43): buildFlowStages(), isPendingFlow(), nextStage(), stageForRole(), allowances, approvalQueue(), attachFlowStages(), completeAllowance() (+35 more)

### Community 22 - "Certificates API"
Cohesion: 0.09
Nodes (39): addTemplate(), attachIssuedFile(), certificates, certRequests, createCertificate(), createCertRequest(), downloadCertificate(), downloadTemplate() (+31 more)

### Community 23 - "Meetings API"
Cohesion: 0.11
Nodes (41): absenceLog(), addAction(), cancelMeeting(), createMeeting(), downloadMom(), empLabel(), fmtDay(), fmtDayShort() (+33 more)

### Community 24 - "Docs & Contact Picker"
Cohesion: 0.07
Nodes (32): docsApi, fileUrl(), designApi, marketingApi, reportsApi, EmployeeSupportPage(), fmtDate(), fmtMonth() (+24 more)

### Community 25 - "Leave & Travel Page"
Cohesion: 0.08
Nodes (29): AllowanceTab(), resetForm(), submit(), ApprovalsTab(), decide(), decideButtons(), decideDirect(), decideSimpleButtons() (+21 more)

### Community 26 - "Deliverables Workflow API"
Cohesion: 0.07
Nodes (38): createDeliverable(), deleteDeliverable(), deliverables, drawings, logDeliverable(), myRevisions(), myTasks(), revisions (+30 more)

### Community 27 - "Salesforce Integration"
Cohesion: 0.11
Nodes (37): baseUrl(), salesforceSettings(), text(), existingProjectsFor(), getSalesforceProject(), salesforceStatus(), searchSalesforceProjects(), sendSalesforceError() (+29 more)

### Community 28 - "Verify Compose Stack"
Cohesion: 0.05
Nodes (40): condition, depends_on, environment, healthcheck, image, platform, ports, volumes (+32 more)

### Community 29 - "BLR Roster Import"
Cohesion: 0.11
Nodes (29): DEPARTMENT_HEADS, ROSTER, USERS, apply, args, emailUpdates(), known, applyRepair() (+21 more)

### Community 30 - "E2E Local Servers"
Cohesion: 0.07
Nodes (25): connections, dist, server, connections, dist, server, f, startPdfFixture() (+17 more)

### Community 31 - "Work Entries & Logout"
Cohesion: 0.12
Nodes (31): react-router-dom, Field(), workEntriesApi, isPendingLogout(), takePendingLogout(), tasksApi, teamsMineApi, DesignHeadWorkUpdatePage() (+23 more)

### Community 32 - "My Work Page"
Cohesion: 0.10
Nodes (36): actionLabel(), isDueSoonAction(), isOverdueAction(), attendanceNames(), dayLabel(), daysSince(), displayDate(), employeeLabel() (+28 more)

### Community 33 - "Stage Timeline API"
Cohesion: 0.13
Nodes (30): expandServices(), APPROVERS, assignments(), resolveService(), servicesFor(), stageNotification(), stageTimeline(), targetFor() (+22 more)

### Community 34 - "E2E Browser Checks"
Cohesion: 0.05
Nodes (20): checks, errors, f, out, checks, contexts, errors, f (+12 more)

### Community 35 - "Server Config"
Cohesion: 0.11
Nodes (25): app, httpServer, config, rawOrigins, required(), requireJwtSecret(), connectDb(), ROLE_KEYS (+17 more)

### Community 36 - "Service Models & GFC"
Cohesion: 0.08
Nodes (25): gfcReadiness(), AreaSettlement, areaSettlementSchema, BimWorkOrder, bimWorkOrderSchema, BOQ_STATUSES, BoqItem, boqItemSchema (+17 more)

### Community 37 - "Attendance Rules"
Cohesion: 0.13
Nodes (30): zod@^4.6.5, ATTENDANCE_EXEMPT_ROLES, ATTENDANCE_LATE_CUTOFF, ATTENDANCE_LATE_CUTOFF_MINUTES, ATTENDANCE_STANDARD_HOURS, isAttendanceExemptRole(), isLateLogin(), istDayKey() (+22 more)

### Community 38 - "Finance OCC Models"
Cohesion: 0.07
Nodes (33): docSchema, FIN_OCC_APPROVALS, FIN_OCC_KINDS, FIN_OCC_PAYMENTS, FIN_OCC_SETTLEMENTS, FIN_OCC_STATUSES, FinanceOccEntry, financeOccSchema (+25 more)

### Community 39 - "Combobox Component"
Cohesion: 0.09
Nodes (27): Combobox(), choose(), onKeyDown(), Highlight(), ContactPicker(), F(), formatDate(), ResultRow() (+19 more)

### Community 40 - "Design Team Page"
Cohesion: 0.21
Nodes (29): api(), AssignDialog(), Counts(), DailyStrip(), dateText(), DayBar(), dayOf(), DesignTeamPage() (+21 more)

### Community 41 - "Bookings API"
Cohesion: 0.17
Nodes (31): bookingSummary, cancelBooking, createBooking, current(), fail(), parse(), persist(), populate (+23 more)

### Community 42 - "Meeting Model"
Cohesion: 0.07
Nodes (31): ACTION_PRIORITIES, ACTION_STATUSES, actionSchema, attendanceSchema, CONDUCTED_BY_BY_TYPE, INVITE_RESPONSES, inviteSchema, MEETING_CATEGORIES (+23 more)

### Community 43 - "API Dependencies"
Cohesion: 0.08
Nodes (32): author, dependencies, bcryptjs@^3.0.3, cookie-parser@^1.4.7, cors@^2.8.5, dotenv@^18.0.6, express@^5.2.1, jsonwebtoken@^9.0.3 (+24 more)

### Community 44 - "Announcements"
Cohesion: 0.10
Nodes (19): ANNOUNCEMENT_READERS, ANNOUNCEMENT_SENDERS, navFor(), Announcement, recipientSnapshot, schema, AnnouncementRecipient, schema (+11 more)

### Community 45 - "Design Head Updates"
Cohesion: 0.11
Nodes (24): arr(), delivStatusLabel(), DesignKpiRow(), fmtAssocDate(), normStatus(), ON_TRACK_STATUSES, rfiDisplayStatus(), rfiSourceOf() (+16 more)

### Community 46 - "My Coordination Page"
Cohesion: 0.14
Nodes (27): allocProjectId(), allocProjectLabel(), APPROVAL_OPTIONS, approvalLabel(), CoordinationKpis(), coordinatorFor(), CoordRfiTab(), DirectoryTab() (+19 more)

### Community 47 - "Web Tooling Deps"
Cohesion: 0.11
Nodes (25): eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, @types/react, @types/react-dom, vite (+17 more)

### Community 48 - "Dashboard & SPOC API Client"
Cohesion: 0.13
Nodes (24): downloadCsv(), transmittalRegisterApi, spocApi, CREATOR_ROLES, EMPTY_BRANCH_STAGE_COUNTS, EMPTY_STAGE_COUNTS, STATUS_KPIS, AssignedRegisterView() (+16 more)

### Community 49 - "Container & Spreadsheet E2E"
Cohesion: 0.08
Nodes (15): areaRevisionSchema, serviceDashboardSchema, checks, der, errors, f, output, publicKey (+7 more)

### Community 50 - "Approval Flow Config"
Cohesion: 0.10
Nodes (22): APPROVAL_STAGES, approvalStagesField(), deriveFlowStatus(), FLOW_APPROVED, FLOW_APPROVER_ROLES, FLOW_OVERSIGHT_ROLES, FLOW_PENDING, FLOW_PENDING_FINANCE (+14 more)

### Community 51 - "Transmittals API"
Cohesion: 0.14
Nodes (24): buildEntry(), createFromDrawings(), createTransmittal(), escapeRegExp(), exportPdf(), exportWorkbook(), getTransmittal(), IMPORT_MAP (+16 more)

### Community 52 - "E2E Package"
Cohesion: 0.09
Nodes (26): dependencies, dotenv@^16.4.5, description, devDependencies, mongodb-memory-server@^11.3.0, @playwright/test@^1.49.1, @types/node@^22.10.2, typescript@^5.7.3 (+18 more)

### Community 53 - "Employees API"
Cohesion: 0.13
Nodes (22): createEmployee(), employeeFilters(), escapeRegExp(), getEmployee(), listAllocationOptions(), listEmployees(), listSpocOptions(), updateEmployee() (+14 more)

### Community 54 - "Client Update E2E"
Cohesion: 0.08
Nodes (13): args, checks, errors, f, out, run, webURL, bcrypt (+5 more)

### Community 55 - "Client Portal API"
Cohesion: 0.13
Nodes (19): acknowledge(), acknowledgeStage(), myPortal(), portalProjects(), respondRfi(), setPortalUsers(), uploadForRequest(), Rfi (+11 more)

### Community 56 - "Reference Dashboard Views"
Cohesion: 0.09
Nodes (24): Datum Dashboard with Meetings (prototype), Chart.js 4.4.0, Department Dashboards (Structural, Mechanical, Electrical, PHE, Fire), Finance Operations Control Centre (PO, travel advance, bill verification, reimbursement, audit trail), SheetJS xlsx 0.18.5, Client Project Portal view, Completion Certificates view, Coordinator view (+16 more)

### Community 57 - "Roles & Nav Config"
Cohesion: 0.11
Nodes (19): ATTENDANCE_TIMEZONE, EXTRA_HOURS_THRESHOLD, BOARD_ROLES, DIRECTIVE_ROLES, FINANCE_HUB_NAV, FULL_LEADERSHIP_NAV, homeView(), INTERNAL_ROLES (+11 more)

### Community 58 - "Billing API"
Cohesion: 0.16
Nodes (20): billingApproved(), claims, commercialOverview(), createClaim(), createPayment(), financeOverview(), payments, projectCosts() (+12 more)

### Community 59 - "Reports & Drawing Acks"
Cohesion: 0.13
Nodes (15): listDrawingAcks(), departmentOverview(), managementOverview(), Discrepancy, discrepancySchema, Drawing, drawingSchema, DrawingAck (+7 more)

### Community 60 - "Marketing API"
Cohesion: 0.13
Nodes (20): collateral, contacts, contactSummary(), createCollateral(), createContact(), getBrief(), portfolio(), saveBrief() (+12 more)

### Community 61 - "Sidebar & Branding"
Cohesion: 0.17
Nodes (14): lucide-react, lucide-react@^1.52.0, BrandLogo(), initials(), navIcon(), Sidebar(), move(), persist() (+6 more)

### Community 62 - "Meetings Common UI"
Cohesion: 0.17
Nodes (14): AttendanceEditor(), defaultDate(), defaultTime(), fmtDate(), idOf(), MeetingDetailModal(), ModalInviteResponse(), MomSection() (+6 more)

### Community 63 - "Session & Sign-out"
Cohesion: 0.21
Nodes (18): src/lib/session.js (SUPER_ROLES, DIRECTIVE_ROLES, exemptions), MAN_HOUR_NOTE, SignOutButton(), checkAttendance(), doLogout(), goToEntry(), handleClick(), saveAttendAndLogout() (+10 more)

### Community 64 - "Documents Upload API"
Cohesion: 0.21
Nodes (16): addBriefPhotos(), addEmployeeDoc(), addFinanceOccDocs(), addVisitPhotos(), billUpload, briefPhotosUpload, downloadStored(), drawingDocumentAccess (+8 more)

### Community 65 - "Support Tickets API"
Cohesion: 0.23
Nodes (15): attachSalarySlip(), createTicket(), myTickets(), requesterUsers(), resolveEmployee(), salarySlipUpload, tickets, updateTicket() (+7 more)

### Community 66 - "Stakeholder Update Docs"
Cohesion: 0.12
Nodes (17): Client PDF Implementation (27 Oct 2026), Elapsed time / same-day re-login attendance fix, Service dropdown derived from directory data with department aliases, Announcements on hold (R-CU11), Employee-ID based allocations (no name matching), Operations Manual, Bell socket.io push with 60s REST fallback, Late sign-in / sign-out gate (09:45 IST, 8h) (+9 more)

### Community 67 - "Shared Travel Booking Logic"
Cohesion: 0.20
Nodes (14): baselineAmount(), bookingStatus(), CANCEL_REASONS, cancellationCost(), day(), hasKnownAmount(), hasStayCosts(), minor() (+6 more)

### Community 68 - "Project Pulse"
Cohesion: 0.22
Nodes (15): daysBetween(), deptOfService(), empDisplay(), fmtDate(), fmtShort(), idOf(), inr(), isExternalReason() (+7 more)

### Community 69 - "Users API"
Cohesion: 0.26
Nodes (12): roleLabel(), createPortalUser(), createUser(), listUsers(), toPublicUser(), updateUser(), router, adminCreateUserSchema (+4 more)

### Community 70 - "Finance OCC API"
Cohesion: 0.21
Nodes (13): createFinanceOcc(), decideFinanceOcc(), deleteFinanceOcc(), financeOcc, financeOccSummary(), myFinanceOcc(), POPULATE, updateFinanceOcc() (+5 more)

### Community 71 - "Service Dashboards API"
Cohesion: 0.16
Nodes (12): listServiceDashboards(), saveServiceDashboard(), DASHBOARD_SERVICES, ServiceDashboard, DASHBOARD_WRITERS, router, areaRevisionOpt, countOpt (+4 more)

### Community 72 - "Web Runtime Deps"
Cohesion: 0.14
Nodes (14): chart.js, react-chartjs-2, react-dom, socket.io-client, dependencies, chart.js@^4.5.1, react@^19.2.8, react-chartjs-2@^5.3.1 (+6 more)

### Community 73 - "BLR Account Review Docs"
Cohesion: 0.23
Nodes (12): Account Availability and Login Follow-up (27 Oct 2026), add-blr-users.js importer (read-only default, --apply), audit-blr-users.js BLR account audit, BLR employee workbook (462 rows, 286 reference logins), HTTPS certificate does not match documented IP, 'Failed to fetch' login transport failure, SPOC picker fixed 'Coordinators' department option, Stage completion: PTL request -> SPOC -> TD approval -> Admin billing (+4 more)

### Community 74 - "Deployment Docs"
Cohesion: 0.21
Nodes (12): Deployment Run Sheet (Windows server via UltraViewer), certbot sidecar (Let's Encrypt IP certificate), Deployment phases 0-5, rollout\install-designtree-ca.bat, WAN forwarding blocker (mail webmail on WAN:443), Environment Reference (production .env), CLIENT_ORIGIN allowlist, COOKIE_SECURE (+4 more)

### Community 75 - "Nginx Gateway & dbadmin"
Cohesion: 0.18
Nodes (12): upstream dbadmin_backend (mongo-express:8081), location /dbadmin/ (3-lock: IP allowlist, basic-auth, mongo-express login), Gateway nginx default.conf (active config dump), HTTP 80 -> HTTPS 301 Redirect, certbot sidecar / Let's Encrypt for public IP, docs/BACKUP_RESTORE.md, docs/DEPLOYMENT.md, docs/ENVIRONMENT.md (+4 more)

### Community 76 - "Director Teams Page"
Cohesion: 0.28
Nodes (10): teamsApi, DirectorTeamsPage(), chooseService(), resetMembers(), experienceText(), id(), name(), projectLabel() (+2 more)

### Community 77 - "Employee Meetings UI"
Cohesion: 0.19
Nodes (10): AbsenceLogTab(), copyExcel(), fallbackCopy(), empName(), dayKey(), EmployeeMeetings(), unavailableOf(), fmtDayLong() (+2 more)

### Community 78 - "Announcements Page"
Cohesion: 0.31
Nodes (11): AnnouncementsPage(), Compose(), date(), Detail(), ErrorText(), post(), Report(), buildBody() (+3 more)

### Community 79 - "Travel Booking Model"
Cohesion: 0.20
Nodes (10): TRAVEL_MANAGER_ROLES, BOOKING_STATUSES, cancellationSchema, eventSchema, feeSchema, travelBookingSchema, body(), call() (+2 more)

### Community 80 - "Variations"
Cohesion: 0.26
Nodes (9): variations, Variation, VARIATION_APPROVAL_STATUSES, VARIATION_STEPS, variationSchema, objectId, strOpt, variationSchema (+1 more)

### Community 81 - "Work Items"
Cohesion: 0.26
Nodes (9): workItems, WORK_ITEM_STATUSES, WORK_ITEM_TYPES, WorkItem, workItemSchema, objectId, strOpt, workItemSchema (+1 more)

### Community 82 - "Compose Gateway Service"
Cohesion: 0.17
Nodes (12): container_name, env_file, environment, image, networks, restart, CLIENT_ORIGIN, MONGO_URI (+4 more)

### Community 83 - "E2E TS Config"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+3 more)

### Community 84 - "Web SPA Entry Docs"
Cohesion: 0.20
Nodes (11): location / SPA static + try_files fallback, GET /api/meta/bootstrap, api/src/config/roles.js (single source of truth for roles/nav), Google Fonts (IBM Plex, Sora, Public Sans), web/index.html SPA entry, Mobile web-app / PWA meta tags (theme #1d68d6), #root mount + /src/main.jsx module, src/layout/AppShell.jsx (Sidebar + Topbar) (+3 more)

### Community 85 - "Notification Bell"
Cohesion: 0.24
Nodes (8): NotifBell(), handleItem(), pathForLink(), timeAgo(), notificationsApi, getSocket(), listeners, subscribeNotifications()

### Community 86 - "Branches API"
Cohesion: 0.29
Nodes (7): branchOptions(), createBranch(), listBranches(), updateBranch(), router, branchSchema, branchUpdateSchema

### Community 87 - "Employee Meetings API"
Cohesion: 0.24
Nodes (8): createEmployeeMeeting(), employeeMeetingSchema, listEmployeeMeetings(), meetingTypes, objectId, EmployeeMeeting, employeeMeetingSchema, router

### Community 88 - "Stage Reviews"
Cohesion: 0.27
Nodes (8): stageReviews, STAGE_REVIEW_OUTCOMES, StageReview, stageReviewSchema, objectId, stageReviewSchema, stageReviewUpdateSchema, strOpt

### Community 89 - "Compose Mongo Dependency"
Cohesion: 0.18
Nodes (11): depends_on, mongo, condition, container_name, depends_on, image, networks, ports (+3 more)

### Community 90 - "Client Feedback Nov Docs"
Cohesion: 0.18
Nodes (11): /api/teams/company-directory (Teams for AD/TD/ATD), Shared read-only travel report (TravelRequest + TravelBooking), Client Feedback (2 Nov 2026, continued), Job number column removed from team log, Project team log (filter-driven, replaces directory table), TD company directory limited to saved department + headOfDepartments, Travel Booking scope: HR, Founding Director, Finance, traveller, Employee Feedback (29 Oct 2026) (+3 more)

### Community 91 - "Salesforce Connector Setup"
Cohesion: 0.22
Nodes (7): DesignTree Salesforce Read-only Connector, Salesforce Dev Org Fixture (Project__c), External Client App (OAuth Client Credentials Flow), Salesforce -> DesignTree Field Mapping / Normalizer, DesignTree_Salesforce_Dev Permission Set, Project__c Custom Object (13 fields), Synthetic Test Records (PRJ-00427/428/429)

### Community 92 - "Employee Select"
Cohesion: 0.47
Nodes (8): EmployeeFilter(), EmployeeSelect(), employeeId(), employeeName(), employeeRecord(), employeeServices(), filterEmployees(), ProposeCoordinatorPanel()

### Community 93 - "Variations Panel"
Cohesion: 0.22
Nodes (9): APPROVAL_STATUSES, EMPTY_FORM, fmtVariationDate(), SERVICE_OPTIONS, stepLabel(), VARIATION_STEPS, VariationsPanel(), WRITER_ROLES (+1 more)

### Community 94 - "Register CRUD API"
Cohesion: 0.29
Nodes (8): createRecord(), crud, FULL_REGISTER_ROLES, listRecords(), scopedProjectIds(), sendTransmittalPdf(), transmittalRecordSchema, transmittalRecordUpdateSchema

### Community 95 - "Compose Networks"
Cohesion: 0.20
Nodes (9): driver, driver, name, networks, backend, frontend, services, volumes (+1 more)

### Community 96 - "Compose API Service"
Cohesion: 0.20
Nodes (10): condition, api, container_name, depends_on, env_file, image, networks, ports (+2 more)

### Community 97 - "Shared Stage Dates"
Cohesion: 0.36
Nodes (9): calendarDays(), dateOnly(), day(), daysBetween, nextDay(), stageMetrics(), timelineLabel(), today() (+1 more)

### Community 98 - "Compose Certbot Service"
Cohesion: 0.22
Nodes (9): container_name, depends_on, entrypoint, env_file, image, restart, gateway, condition (+1 more)

### Community 99 - "Compose Mongo Service"
Cohesion: 0.22
Nodes (9): MONGO_INITDB_DATABASE, MONGO_INITDB_ROOT_PASSWORD, MONGO_INITDB_ROOT_USERNAME, container_name, environment, image, networks, restart (+1 more)

### Community 100 - "Director Updates Docs"
Cohesion: 0.22
Nodes (8): QA/QC navigation removed for AD/TD/ATD, /api/teams/reporting-directory (My Team for AD/TD/ATD), TL/ATD My team (employee list) grouped by reporting lead, qs-log vs qs-head navigation assertion mismatch, Director Updates (26 Oct 2026), ATD Assign work, AD/ATD service/QS editors log-only, Teams/My Team Department-Project-Member selectors

### Community 101 - "Design Mgmt My Team Doc"
Cohesion: 0.25
Nodes (7): Design Management heads see every eligible coordinator's daily entries, DMH SPOC dashboard / man-hour register request (pending explanation doc), Design Management My Team, Project.coordinationStatus (Delayed, Awaiting info, Ready for billing), DesignTeamEvent append-only history, Design Management My Team dashboard, Workload capacity points (DESIGN_TEAM_CAPACITY, Light/Balanced/Heavy)

### Community 102 - "API Gateway & Cookie Auth"
Cohesion: 0.25
Nodes (7): helpers/api.ts (apiLogin, ensureProjectViaApi, ensureTeamsViaApi), upstream api_backend (api:5000), location /api/ (cookie JWT pass-through), location /socket.io/ (Upgrade headers), Realtime Bell via socket.io (60s REST fallback), API client modules (api.js, spocApi, workApi, phase3Api, phase4aApi, phase4bApi, ...), src/lib/realtime.js (socket.io singleton)

### Community 103 - "E2E Helpers & Fixtures Docs"
Cohesion: 0.22
Nodes (7): helpers/asserts.ts (expectToast/expectTableRow), helpers/auth-ui.ts (signIn/signOut/gotoNav), fixtures/project.ts (DT-2601 payload), fixtures/roles.ts (11-person cast), fixtures/scorecard.ts (28-row checklist), Specs 01-09 (cast creation to GFC approval), Login selectors #loginEmail/#loginPassword/.login-btn

### Community 104 - "Stakeholder Browser E2E"
Cohesion: 0.22
Nodes (5): checks, errors, f, out, sessions

### Community 105 - "Reference Meetings App"
Cohesion: 0.28
Nodes (8): designMeetingsLog, dmRenderMgmtAnalytics(), Employee Meeting Dashboard (embedded app), Meeting absences by team member (renderAbsence), My action items (meeting follow-ups), Meeting availability responses (respForm), Minutes of Meeting (downloadMom / mtMomBody), mtSchedule()

### Community 106 - "Reference Role Navigation"
Cohesion: 0.25
Nodes (6): Meetings dashboard iframe loader (showView wrapper), meetingsDashSrc (base64-embedded Employee Meeting Dashboard), roleCanAccess(), showView(), switchRole(), Meetings Dashboard view

### Community 107 - "Compose Volumes"
Cohesion: 0.50
Nodes (8): volumes, volumes, volumes, volumes, read_only, source, target, type

### Community 108 - "Client Update Docs"
Cohesion: 0.25
Nodes (8): Client Workflow Updates (23 Oct 2026), Project coordination items with overdue tracking, Directors read-only in Finance OCC/Billing, Marketing provenance filter, Requirement IDs R-CU01..R-CU31, SPOC-owned PMC and Peer Review contacts, SPOC Contact Reflection Fix (26 Oct 2026), ContactPicker immediate project link

### Community 109 - "Container Security Docs"
Cohesion: 0.25
Nodes (7): Container Security Update (23 Oct 2026), dbadmin Compose profile (mongo-express, default off), docker-compose.verify.yml disposable verification stack, Pinned images: Node 22.23.4, Nginx 1.30.6, MongoDB 7.0.45, SheetJS 0.20.3 from official CDN, Trivy scan: MongoDB image residual findings, Access map (public/LAN, health, dbadmin loopback)

### Community 110 - "Revision Summary"
Cohesion: 0.43
Nodes (6): normalizedStage(), REVISION_STAGES, revisionService(), STAGE_ALIASES, stageWasCompleted(), summarizeRevisions()

### Community 111 - "Meeting Team Utils"
Cohesion: 0.48
Nodes (6): responsibleFor(), committedServices(), empLabel(), normService(), projectTeamBundle(), resolveResponsible()

### Community 112 - "Transmittal Model"
Cohesion: 0.29
Nodes (6): historySchema, Transmittal, TRANSMITTAL_METHODS, TRANSMITTAL_RECIPIENTS, TRANSMITTAL_STATUSES, transmittalSchema

### Community 113 - "Compose Healthcheck"
Cohesion: 0.48
Nodes (7): healthcheck, interval, retries, start_period, test, timeout, healthcheck

### Community 114 - "Compose Mongo-Express"
Cohesion: 0.29
Nodes (7): ME_CONFIG_BASICAUTH, ME_CONFIG_BASICAUTH_PASSWORD, ME_CONFIG_BASICAUTH_USERNAME, ME_CONFIG_MONGODB_ENABLE_ADMIN, ME_CONFIG_MONGODB_URL, ME_CONFIG_SITE_BASEURL, environment

### Community 115 - "Employee PDF Docs"
Cohesion: 0.29
Nodes (7): Employee PDF Updates (28 Oct 2026), Board Holiday calendar removal, Founding/Working/Executive Director log-only scope, container-spreadsheets.test.mjs (Docker-only harness), HR External access removal, Pending approved service-wise roster, container-fixture.mjs seeding script

### Community 116 - "Dashboard Release Docs"
Cohesion: 0.29
Nodes (7): Dashboard Workflow Release (dev/vishwa), Admin client certificate links (CERTIFICATE_LINK_DAYS, 30 days), Project service checkboxes (STR, PHE, ELE, HVAC, ...), Saral/Salesforce integration deferred, SPOC-managed meetings and MOM records, Filtered transmittal log PDF export (pdfkit), SF_* Salesforce import variables

### Community 117 - "DMH Browser E2E"
Cohesion: 0.29
Nodes (4): checks, errors, f, out

### Community 118 - "PDF Oct28 E2E"
Cohesion: 0.29
Nodes (4): checks, errors, f, out

### Community 119 - "PDF Oct29 E2E"
Cohesion: 0.29
Nodes (4): checks, errors, f, out

### Community 120 - "Platform Overview Docs"
Cohesion: 0.29
Nodes (7): api/ Express 5 + Mongoose API, 27 Login Roles (ROLE_KEYS), npm run seed (superuser provisioning), /api/integrations/salesforce/* endpoints, ClientPortalPage.jsx (client/architect portal), src/pages/HRPage.jsx (12-tab HR), PROJECT_CREATORS = {admin_billing}

### Community 121 - "Notifications API"
Cohesion: 0.53
Nodes (4): markAllRead(), markRead(), myNotifications(), router

### Community 122 - "Compose Web Build"
Cohesion: 0.33
Nodes (6): build, VITE_API_URL, args, context, dockerfile, build

### Community 123 - "Backup & Restore"
Cohesion: 0.53
Nodes (5): Backup & Restore Runbook, backup.ps1 (mongodump + robocopy uploads), designtree_mongo-data named volume, restore.ps1 (interactive RESTORE confirmation, mongorestore --drop), Uploads host bind (D:\designtree-uploads)

### Community 124 - "PDF Oct27 E2E"
Cohesion: 0.33
Nodes (4): checks, errors, f, out

### Community 125 - "Delivery Flow Overview"
Cohesion: 0.33
Nodes (4): Delivery Flow: Admin -> DMH -> SPOC -> Execution -> GFC, DesignTree e2e Delivery Flow Suite (Playwright), scripts/backup.ps1 and restore.ps1, DesignTree Datum Workspace

### Community 126 - "Brand Logo & PWA Icons"
Cohesion: 0.40
Nodes (6): Apple Touch Icon 180x180, DesignTree Service Consultants Brand Mark (globe 'D' + green tree 't', tagline 'We design We care'), DesignTree Logo (logo.png), PWA Icon 192x192, PWA Icon 512x512, PWA Maskable Icon 512x512

### Community 127 - "Reporting Team Panel"
Cohesion: 0.60
Nodes (5): experienceText(), fullName(), idOf(), norm(), ReportingTeamPanel()

### Community 129 - "SPOC Picker E2E"
Cohesion: 0.40
Nodes (4): checks, errors, f, out

### Community 130 - "TL Assignment E2E"
Cohesion: 0.40
Nodes (4): checks, errors, f, out

### Community 131 - "Gateway Entrypoint"
Cohesion: 0.60
Nodes (3): public_hash(), render(), entrypoint.sh script

### Community 132 - "Reference HR Module"
Cohesion: 0.50
Nodes (5): hmRender(), hmSubmit(), hrLoginHours (HR login hours data), meetingLog (HR employee meeting log data), HR Module view

### Community 133 - "Web Scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 134 - "SPOC Meetings Nav"
Cohesion: 0.40
Nodes (3): SpocMeetings(), projLabel(), CoordinationMeetingsTab()

### Community 136 - "Claim Model"
Cohesion: 0.50
Nodes (3): Claim, CLAIM_STATUSES, claimSchema

### Community 137 - "Recruitment Model"
Cohesion: 0.50
Nodes (3): Recruitment, RECRUITMENT_STATUSES, recruitmentSchema

### Community 138 - "Reference Billing Alerts"
Cohesion: 0.50
Nodes (3): blCheckNotifications() (billing readiness alerts), pushAppNotification(), Billing view

### Community 139 - "Reference Leave & Travel"
Cohesion: 0.50
Nodes (3): travelRequests (travel/cab requests data), trvSubmitRequest(), Leave & Travel view

### Community 141 - "Reference Pulse View"
Cohesion: 0.67
Nodes (3): DesignTree Pulse renderAll(), fdtpSaveEntry() (Pulse daily log editing), DesignTree Pulse view

## Ambiguous Edges - Review These
- `Founding/Working/Executive Director log-only scope` → `Stage completion: PTL request -> SPOC -> TD approval -> Admin billing`  [AMBIGUOUS]
  docs/CLIENT_PDF_20261028.md · relation: conceptually_related_to
- `Production Deployment (Windows server, Docker compose)` → `location /dbadmin/ (3-lock: IP allowlist, basic-auth, mongo-express login)`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to
- `certbot sidecar / Let's Encrypt for public IP` → `HTTP 80 -> HTTPS 301 Redirect`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to

## Knowledge Gaps
- **82 isolated node(s):** `Service dropdown derived from directory data with department aliases`, `HR External access removal`, `Board Holiday calendar removal`, `Pending approved service-wise roster`, `Project team log (filter-driven, replaces directory table)` (+77 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 970 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `mongoose` connect `Server Config` to `Entry Documents API`, `Project Import & Services`, `Design Mgmt Workflow API`, `Claim Model`, `Recruitment Model`, `Functions & Checklists API`, `Teams & Directory API`, `Express App & Access`, `Certificates API`, `Deliverables Workflow API`, `BLR Roster Import`, `Service Models & GFC`, `Attendance Rules`, `Finance OCC Models`, `Meeting Model`, `API Dependencies`, `Announcements`, `Container & Spreadsheet E2E`, `Approval Flow Config`, `Transmittals API`, `Client Update E2E`, `Client Portal API`, `Billing API`, `Reports & Drawing Acks`, `Marketing API`, `Travel Booking Model`, `Variations`, `Work Items`, `Employee Meetings API`, `Stage Reviews`, `Transmittal Model`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **What connects `Service dropdown derived from directory data with department aliases`, `HR External access removal`, `Board Holiday calendar removal` to the rest of the system?**
  _82 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Routes & Panels` be split into smaller, more focused modules?**
  _Cohesion score 0.04130972777460499 - nodes in this community are weakly interconnected._
- **Why does `Panel()` connect `Shared Page Components` to `App Routes & Panels`, `Design Team Panel & Writers`, `Stage Approval UI`, `SPOC Meetings Nav`, `Entry Docs & Login Hours UI`, `Modals & React Query`, `Reporting Team Pages`, `SPOC Meetings UI`, `KPI & Coordination Panels`, `Docs & Contact Picker`, `Leave & Travel Page`, `Work Entries & Logout`, `My Work Page`, `Combobox Component`, `Design Team Page`, `Design Head Updates`, `My Coordination Page`, `Dashboard & SPOC API Client`, `Meetings Common UI`, `Director Teams Page`, `Employee Meetings UI`, `Announcements Page`, `Employee Select`, `Variations Panel`, `Reporting Team Panel`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Should `Shared Page Components` be split into smaller, more focused modules?**
  _Cohesion score 0.057076295864880604 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Founding/Working/Executive Director log-only scope` and `Stage completion: PTL request -> SPOC -> TD approval -> Admin billing`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Production Deployment (Windows server, Docker compose)` and `location /dbadmin/ (3-lock: IP allowlist, basic-auth, mongo-express login)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._