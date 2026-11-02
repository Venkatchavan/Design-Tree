# Stakeholder updates, 24 October 2026

Implements seven requests from the AD, TL and engineer presentation. TL submit-button removal (R-ST06) remains held by the user's direct instruction. Announcements and approval routing are unchanged.

- **R-ST01:** Dashboard stage displays use `Project.currentStage`, consistent with the saved project summary. Project lists, summary queries and engineer team queries refresh every ten seconds. Per-service `StageStatus` completion and billing approvals remain separate; completing a service stage does not automatically advance the project-wide stage.
- **R-ST02:** The Project update history panel is removed from the shared project detail view. Audit capture, saved records and the existing authorized history API remain available. Work/revision logs remain available.
- **R-ST03:** Project summary arrows expand matching names and codes using a scoped, unpaginated summary endpoint. Status filters use the stored status values.
- **R-ST04 / R-ST05:** Project rosters combine active team assignments, including the lead for display. An empty derived nomination team cannot hide another active team's members. Task selection uses the selected project's members and checks membership again before submission. Saving nominations, or explicitly selecting **Refresh saved team allocations** in SPOC Project Directory, resolves old name-only nominations when exactly one non-exited employee matches the saved name or employee code. Ambiguous or missing matches return warnings and preserve the existing service team for correction. Proposed nominations are not activated. There is no startup migration.
- **R-ST07 / R-ST08:** Engineers have separate My Projects and Projects on Hold sections. An assigned, approved SPOC can save Active / On Hold with a required reason; the reason, actor, date and transition history are retained. Completed projects cannot be resumed through this action. Concurrent changes return a refresh conflict. Stage completion and billing records are not changed.

The two reported deployed team-member cases require acceptance against their actual data and deployed commit. Synthetic local coverage establishes the repaired paths; it does not establish the cause or resolution of those specific production records.

## Verification

`e2e/stakeholder-updates.test.mjs` covers stage round trips, scoped summaries beyond 200 records, hold authorization and audit retention, legacy roster resolution and ambiguous matches. `e2e/stakeholder-updates-browser.mjs` covers the production frontend bundle with real roles against a disposable local API/Mongo fixture, including both retained submission buttons.

Run the API checks with the normal local Node dependencies and a MongoMemoryServer binary:

```sh
MONGOMS_DOWNLOAD_DIR=/tmp/designtree-mongo-binaries node --test e2e/stakeholder-updates.test.mjs e2e/client-updates.test.mjs
npm --prefix web run build
```

For browser checks, start `node e2e/stakeholder-local-server.mjs`, then run `node e2e/stakeholder-updates-browser.mjs`. The helper binds only to loopback (API 19520, web 5173), writes disposable credentials with mode 0600 under `/tmp`, and removes them on shutdown. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` may point to the installed Chrome for Testing. Existing client browser checks accept `TEST_FIXTURE_FILE`, `TEST_WEB_URL` and `TEST_REPORT_DIR` for the same isolated fixture. This helper is not a production server.

The existing required-workflows suite has an unrelated ATD navigation assertion expecting `qs-log` while the role registry uses `qs-head`; approval/navigation policy was not changed to satisfy that assertion. Docker builds and production deployment/acceptance were not performed.
