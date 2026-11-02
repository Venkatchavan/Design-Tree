# Client PDF implementation 27 October 2026

The eight-page client PDF contains thirteen actionable items. Five repeat fixes already present in the branch; eight add or revise behavior. All screenshots were reviewed. The source PDF, KG and Word report remain in the separate local knowledge workspace.

| PDF page | Request | Result |
| --- | --- | --- |
| 1 | TL member list | Existing project-roster fix retained and regression checked. Genuine absent allocations still require approved saved records. |
| 1 | Saved job number missing | Existing myTeams jobNumber population fix retained and checked. No number is generated or replaced. |
| 2 | SPOC-only selector | Existing active coordinator/employee eligibility and activation validation retained. The screenshot shows Technical Director, although its heading calls the login Design Management Head; this does not add DMH activation authority. |
| 2 | Names missing from Super User list | Complete eligible choices and excluded-login reasons retained. Actual company role/link corrections remain pending data access. |
| 3 | Elapsed time stays at 0.3 hours | Authenticated status uses the current elapsed time. A same-day re-login clears the previous logout while preserving first login. The reason dialog refreshes every ten seconds and shows hours/minutes. |
| 4 | Saved SPOC PMC and Peer Review not reflected | Existing automatic project-contact association retained; four browser cases rerun with separate evidence output. |
| 5 | Service dropdown absent | Services are derived from saved directory data and configured services; department aliases such as Structure resolve consistently. |
| 5 | Remove department/service search | Removed this text search; service dropdown remains. Existing project search and selection remain. |
| 5 | Team member choices absent | Member choices now include reporting staff who have no project, with dependent service/project filters. Missing actual reporting links are not guessed. |
| 6 | Remove QA/QC navigation for AD/TD/ATD | Removed this sidebar entry for those three roles; unrelated role navigation is retained. |
| 7 | Remove SPOC project panel for AD/TD/ATD | Assigned SPOC display is hidden for these roles. The old proposal panel was already removed from the live view. Saved assignments and stage/billing approval policy are retained. |
| 8 | My Team should show people under each director | New reporting directory combines exact saved director/reporting chains and existing authorized team scope, excludes the director's own row and exited staff, and includes staff without a project. |
| 8 | Teams should show the company directory | New separate read-only company endpoint returns all employee records with status, all projects and services, and branch filtering. Exited records remain visible as directory records; this grants no task-assignment eligibility. |

## Scope and access

AD, TD and ATD use `/api/teams/reporting-directory` for My Team and `/api/teams/company-directory` for Teams. The company directory is the explicit page 8 expansion of earlier director-only Teams scope. Existing `/teams/mine`, direct team/project access and task mutation scope remain restricted as before. The new directory returns only identity, designation, department, branch, status and project/service associations; it excludes email, passwords, salary and other employee profile details.

Reporting identity matching uses exact unique saved IDs/names and existing login aliases. Ambiguous references grant no inferred reporting access. The personal view includes direct/transitive reports without requiring a Team/project association. The company view is a directory and does not create an allocation. Filters preserve service/project/member dependencies and missing records have explicit empty states.

Attendance continues to use the first sign-in of the IST day and the existing eight-hour/late-login rules. Same-day re-login preserves that first sign-in, reopens the daily record and does not reset it to the current login. The authenticated status endpoint no longer reuses an old closed interval. The modal polls only while open, handles refresh failures visibly and removes the early-reason field after the threshold is reached. Exempt roles and nonworking-day rules are retained. Submitted project man-hours are a separate workflow and are not recalculated or changed.

The earlier API test expecting AD QA/QC navigation was updated because page 6 explicitly supersedes that expectation. Announcements and TL Submit removal remain on hold. No production data, employee roles, saved job numbers, contact ownership or billing approval policy was migrated or changed.

## Verification and deployment

64 isolated API tests, seven focused PDF browser cases, four contact browser cases, thirteen existing client browser checks and the web build pass. Three existing lint errors remain in checked web files; no errors were introduced. Browser cases cover all three director roles, service/project/member filtering, company branch inventory, the removed panels/navigation and live elapsed time for SPOC, TL and engineer logins. Docker, Windows and company acceptance were not run.

Deploy this commit before client acceptance. Actual missing employee/role/reporting links, approved allocations and the reported company records remain unverified because database/server access was unavailable. Existing pending company checks remain open in the KG; local feature completion does not close them.
