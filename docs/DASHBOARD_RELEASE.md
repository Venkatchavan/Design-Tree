# Dashboard workflow release — dev/vishwa

Vishwa will deploy and verify production after the local checks and branch push. The supplied workflow documents, screenshots, prototype and knowledge graph remain outside this repository. The updated LoginPage and LoginScene files are unchanged.

## Changed workflows

- TL My Team contains Assign work. The team, monitoring, deliverable, revision, drawing, transmittal, recruitment, meeting and stage-completion views are under the individual project. This applies across services.
- Project creation uses STR, PHE, ELE, HVAC, FIRE, SMEP, SMEPF, MEP, BIM, GBS and separate Peer Review checkboxes. Source accepts typed text. Historical service and priority values remain stored.
- New approved TD/SPOC selections store employee IDs and maintain project-specific service teams. Team membership controls project access. Older name-only allocations are preserved; reselect employees to connect those allocations to their logins. No employee is matched by name automatically.
- SPOC project Coordinator shows the assigned SPOC, directory, meetings, deliverables/drawings, revisions, pending/follow-up and coordination. My Coordination keeps daily work and other assigned projects. The separate RFI tab is removed.
- Only the assigned SPOC schedules or manages meetings. Employees/TLs have the full personal Meetings dashboard; directors have the meeting log. Invitations, attendance, text/original-file MOM, references, actions, progress notes, history and notifications share stored records. Marking Held does not mark everyone present.
- Stage completion requires PTL request → SPOC approval → Technical Director approval → Admin billing. Direct stage/claim writes cannot bypass TD approval. MD is Founding Director and sees results without approval or project/billing edit controls.
- DMH remains a separate role with Design Management, team allocation and read-only certificate/transmittal logs. Associate/TD/Associate-TD have billing and project QS logs. Travel Booking appears only for Finance.
- Daily work accepts stored attachments. The work update action is Submit. Entry forms precede their logs in the affected screens.
- Admin client certificate links work without login for template download, client upload and issued-certificate download. Only Admin generates/replaces links and uploads issued files. Links expire after 30 days by default; `CERTIFICATE_LINK_DAYS` changes that. Replacing a link invalidates the previous one. Use the public web URL, not an authenticated internal API file URL.
- Filtered transmittal logs download as real PDFs, including empty and multipage output.

## Local verification

Use Node 22.12+ for Vite 8 and the current dependencies; this release was checked with Node 26.7 and MongoDB 7.0.24 in a disposable test database. Install dependencies with `npm ci` in api, web and e2e. API runtime now includes pdfkit. Tests do not use production credentials or the application's configured database.

Run the full isolated API acceptance suite:

```sh
cd e2e
npm run test:requirements
```

For browser acceptance, start a fresh disposable API fixture, then prepare workflow data, and start Vite in another terminal:

```sh
# terminal 1, e2e directory
npm run test:local-server

# terminal 2, e2e directory
TEST_FIXTURE_FILE=/tmp/designtree-local-fixture.json npm run test:requirements

# terminal 3, web directory
npm run dev -- --host 127.0.0.1

# terminal 2, e2e directory
npx playwright install chromium
E2E_BASE_URL=http://127.0.0.1:5173 npm run test:browser-workflows
```

The fixture generates temporary users and secrets, saves the fixture outside Git with owner-only permissions and uses loopback services. Stop and restart it for a fresh run. The full API suite includes fixtures for more than 200 meetings and legacy records; those two database-level checks are skipped when only preparing an existing browser fixture. The new browser suite is separate from the older 01–09 specs, which still describe the earlier tab locations.

Build with `npm run build` in web. Repository-wide lint has existing failures; changed files are checked against the original branch to avoid adding new lint findings. The existing large-bundle build warning remains.

## Vishwa's production verification

1. Confirm the checkout is dev/vishwa at the release commit. Back up the existing Mongo volume/database and uploads before rollout. Retain the existing secure environment settings and persistent upload/database mounts. Install the updated API lockfile dependencies and rebuild the web/API images using the repository's deployment process. Do not run the local fixture or seed scripts against production.
2. Check actual user-role and employee links. Re-enter older name-only allocations where those people need project access. Existing stages without TD approval are not grandfathered into billable stages; perform the approval workflow for outstanding stages. Preserve historical billed records.
3. Test a new project with TD-selected PTL, approved SPOC allocation and SPOC-added engineer. Confirm Admin/DMH see the roster, the TD sees the assigned SPOC, the engineer/PTL see this project, and an unrelated employee cannot open its detail or files.
4. In separate sessions, schedule a meeting as SPOC, respond as employee, reschedule, mark held, enter attendance, save/upload MOM, assign an action and update/reopen it as its owner. Reload both sessions; check shared values and notification links. Check socket.io through the existing HTTP/HTTPS gateway and the fallback bell refresh.
5. Request completion as PTL, approve as SPOC, approve as TD, and create/mark the claim as Admin. Verify billing is blocked before TD approval and MD has no edit/approval controls.
6. Generate a certificate link as Admin. Open it without a login and perform all three actions with actual documents. Check expiry/replacement and the existing upload mount after an API restart.
7. Export a filtered transmittal log and check its entries/pages through the production gateway. Confirm Finance-only Travel Booking and the employee/director Meeting dashboards.

Production deployment, gateway/TLS checks and production acceptance remain pending until Vishwa performs them. Saral/Salesforce integration and Saral-based director reporting-chain shortlisting remain deferred until their API documentation is supplied.
