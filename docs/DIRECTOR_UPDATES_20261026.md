# Director updates 26 October 2026

Implements the director requests in 26-10-26.pdf on dev/vishwa. Applies the new Teams experience to AD, TD and ATD, covering the written AD/TD scope and the ATD account shown in the screenshots.

## Result

- AD, TD and ATD sidebar entries for BIM, GBS, Peer Review and QS are removed. Service records and project service tabs remain available.
- Marked ATD variation/review editors and AD/ATD department team, scope and QS editors are log-only. Matching API writer roles are restricted. Other permitted service writers remain available.
- TD project detail no longer mounts the PTL nomination, SPOC proposal or Stage completion approvals panels. Stored allocations, stage history and completion/billing rules remain intact. The existing ATD completion surface remains available. No approval bypass or automatic stage transition was added.
- Teams and My Team have searchable Department / Service, Project and Team Members selectors, live counts, all-authorized-projects selection, empty states and separate service/project sections. Headings use saved Job Number and Project Name. Missing legacy job numbers are displayed as not recorded; internal codes/IDs are retained.
- ATD My Team also has Assign work. Its project roster includes assigned TLs, engineers and drafters, grouped by service. Tasks reach the selected members; direct task writes reject unauthorized project members and updates to another creator's task.

## Saved ownership rules

The directory reads actual active Team, Employee, User, Project and ServiceDashboard records. It never seeds screenshot people or infers access from merely having the same department name.

Employee.director may identify the logged-in director; Employee.reportingManager is followed transitively. Exact unique employee/user IDs, employee codes, email addresses or saved names resolve these legacy strings. Duplicate names grant no ownership. A linked team lead grants the actual team's roster; a linked member grants only that member. A service dashboard's explicit technicalDirector grants the team for that saved project/service pair. Bundled services are split into separate service assignments so ownership of Electrical cannot reveal Mechanical or Plumbing by default.

Missing, ambiguous or revoked links produce an empty scoped result. Team list, mine, detail, project roster and director task APIs enforce the same boundaries. Existing company project dashboards and unrelated department workflows retain their prior access policy. The directory's read scope does not grant new project edits.

If a director sees no teams, an allocation owner must correct the existing director/reporting-manager/service-director links. There is no startup migration or production data repair in this release.

## Verification

Local disposable native MongoDB/API checks cover identity ambiguity, missing/revoked links, service-only ownership, multi-project and bundled-service boundaries, direct IDs, task recipients and retained authorized service writers. Production-bundle browser checks cover all named director roles, requested panels and logs, cascades, Job Number, counts, task delivery, mobile layout and retained TL/employee submit actions.

The existing client API and browser suites are rerun. Broader workflow expectations now follow the 26 October director scope and sidebar removals; the former qs-log/qs-head expectation is superseded by the explicit removal request. Billing controller policy is unchanged.

Announcements and TL submit-button removal remain held. Company production data, deployment and stakeholder acceptance are not verified by local tests.
