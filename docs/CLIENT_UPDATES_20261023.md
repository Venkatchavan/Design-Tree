# Client workflow updates — 23 October 2026

Implemented the 30 confirmed requests from the client change review. Announcements is explicitly on hold (`R-CU11`); its navigation, access and saved notices are unchanged. Production deployment and client acceptance are separate.

## Result

- SPOC owns searchable PMC and Peer Review contacts. Existing Client, Architect and Billing records remain in their separate project-contact section. Allocation rows can be edited to backfill nominations; the role/responsibility input and duplicate coordination-contact table are removed.
- Each project can log and resolve coordination items with a service, channel, topic and deadline. Responsible service/team pages show overdue items. SPOC daily work uses Documents and omits the RFI category; the read-only project RFI Log remains.
- Admin New Project collects source person, referral and all three dates. Project summaries use job number. Authorized Admin can edit general details, contracted services/scope/fees and retained contacts. Updates preserve SPOC-owned contacts.
- Project-linked business records write an append-only audit trail with actor name, time and changed values. History is readable by Admin and the existing director roles. Project imports save individual valid rows so partial imports retain history. Authentication link hashes are excluded from audit details. Background seed/maintenance scripts are outside user-request audit capture; anonymous authorized workflows are labeled External workflow.
- All directors are read-only in Finance OCC, including direct mutation and attachment routes. Director Billing quote and Mark billed controls are removed; authorized Finance/Admin actions and TD/ATD stage approvals remain.
- Marketing lists only projects explicitly originating from Marketing. Admin-created and legacy projects without Marketing provenance are excluded from portfolio counts and brief access. No existing project or marketing brief is deleted or automatically reclassified.
- Confirmed rosters take precedence over older rosters; inactive teams are excluded and My Team refreshes allocations. Project & team groups current members by project. Task creation now records its creator, allowing Work Assigned by Me to work.
- PTL Assign Work has List of Deliverables, Assign Task and Work Assigned by Me in that order. Drawing entry is in Drawing Register with Service/Stage/Revision dropdowns and the persisted register log. Legacy revision values remain selectable.
- My Team has Revision → entry/log; the duplicate project workspace is removed. The PTL progress form omits the assigned-daily-work selector, while the designer My Work entry retains it.
- Peer Review has a live project dashboard and one dashboard Work Tracking entry, retaining the work/revision/peer tools and scoped project links.

## Validation

- Web production/PWA build passed.
- 8 targeted API tests passed: create/edit/audit, immutable history, contact preservation and scope, coordination persistence/scope, six director roles versus Finance, Marketing provenance, Peer Review assignments and confirmed-roster task creation.
- 13 real-role browser checks passed, covering all 30 confirmed requirement IDs.
- 3 real spreadsheet import/export tests passed, including partial row validation.
- Existing workflow suite: 12 passed, 1 pre-existing QS navigation assertion failed, none skipped. The assertion expects `qs-log`; the role registry supplies `qs-head`. This mismatch remains tracked; it was not changed to mask the failure.
- New components pass ESLint. Changed existing pages retain pre-existing lint errors; comparison found no newly introduced lint errors.
- No production data/environment was accessed. Docker image rebuild was not run because the local Docker daemon was unavailable. The isolated checks used native local Node/MongoDB and a web development server; the production/PWA bundle was built separately.

## Reproduce locally

Install locked dependencies with `npm ci --prefix api`, `npm ci --prefix web` and `npm ci --prefix e2e`. Then run:

```sh
npm run build --prefix web
node --test e2e/client-updates.test.mjs
node --test e2e/required-workflows.test.mjs
```

For browser checks, start `node e2e/local-server.mjs` and the web development server. The fixture writes random disposable credentials to a private temporary file. Run `node e2e/client-updates-browser.mjs`; set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` only if using a non-default Chromium installation. The script refuses a non-isolated fixture. Shut down both servers and delete the temporary fixture when finished.

The documentation KG, source PDF, screenshots and local evidence stay outside this application repository.

## Browser acceptance mapping

| Check | Requirement IDs |
|---|---|
| Admin creates marked fields and no duplicate PMC/Peer Review inputs | R-CU01, R-CU12 |
| Project summary Job number, comprehensive editor, saved changes and audit history | R-CU13, R-CU14, R-CU15 |
| SPOC Directory has contact pickers, editable nominations and no duplicate panels | R-CU01, R-CU02, R-CU05, R-CU06, R-CU07, R-CU17 |
| SPOC daily-work Documents label and no RFI category | R-CU04, R-CU18 |
| Coordination entry persists and the responsible team sees Overdue | R-CU03 |
| PTL sees project-grouped members and ordered Assign Work sections; assigns a task | R-CU23, R-CU24, R-CU26, R-CU27 |
| Drawing Register has entry, Service/Stage/Rev dropdowns and persisted log | R-CU25, R-CU28 |
| My Team Revision entry and log work; project detail has no duplicate workspace | R-CU30, R-CU31 |
| Only PTL progress entry hides assigned-daily-work selector | R-CU29 |
| Admin transmittal log remains without Add transmittal | R-CU16 |
| Director Finance and Billing have no edit actions; Finance retains authorized creation | R-CU19, R-CU20, R-CU21 |
| Marketing excludes Admin projects and retains Marketing-owned portfolio | R-CU22 |
| Peer Review dashboard and single dashboard Work Tracking path retain all tools | R-CU08, R-CU09, R-CU10 |
