# Employee PDF updates 28 October 2026

All eight pages and their embedded screenshots were reviewed against the KG and the latest dev/vishwa source (base 8e615e6). Seven requests are implemented locally. The service-wise roster update on page 3 remains pending the approved list the employees say they will provide.

| Page | Asked | Done or left |
| --- | --- | --- |
| 1 | Change HR Teams from old team cards | HR now uses the company service/project/member directory with branch filters, saved job numbers and employee status. No reporting/allocation data is invented. |
| 2 | Remove External access from HR | HR loses the tab and external role choices. Portal creation, generic user creation/role changes and edits of existing external accounts are denied for HR. Admin/Superuser provisioning remains, and no account is deleted. |
| 3 | Update each service's particular team when the list is shared | Pending approved service-wise employee/project/TL allocations and authorized company data access. Existing grouped roster loading is retained. Screenshot names do not establish approved assignments. |
| 4 | HR cannot see travel log | Shared read-only report includes both TravelRequest and Finance TravelBooking records, explicit source labels, all historical dates, stable bounded pagination, refresh and retry. No source records are merged or rewritten. |
| 5 | Board/leadership department team and scope should be logs only | Founding, Working and Executive Directors have no entry controls in the nine marked service panels. Matching dashboard, QS work-item and discrepancy writes are explicitly denied before the general super-role bypass. Existing logs remain. |
| 6 | Marked review log visible with no entry | Those board roles retain saved cross-discipline StageReview records with no Add/Edit inputs. Stage-review and peer-review writes are denied. This is the marked Review log, not the unrelated My Team Revision workflow. |
| 7 | Remove board Holiday calendar | Removed the board HR tab and calendar create/delete authority. HR/Admin entry and calendar reads needed by attendance/working-day rules remain. |
| 8 | Board cannot see past travel | Same historical read-only report for all three board roles. Finance booking management stays Finance-only. |

## Investigation and scope

HR previously took the old team-card path while the company directory was available only to AD/TD/ATD. The travel view read only TravelRequest; the Finance booking workflow saves another collection, TravelBooking. The generic request list was capped at 200 and did not refresh. These are reproduced code gaps, not proof of the inaccessible client's exact production records. The new report retains distinct source-qualified IDs, does not assume a request and booking are the same journey, and labels the quarter count as records.

The written requests name Founding/Working/Executive Directors. Pages 5 and 6 show an ATD login; existing ATD restrictions were already implemented and remain. No new ATD authority or wider removal is inferred from those screenshots. Earlier stage/billing approval policy, Announcements and TL Submit removal holds remain.

The report exposes only the required employee/project identity, trip dates/location/status and existing expense totals for authorized HR/Admin/board readers. The original Finance-only booking editor remains inaccessible to other roles. No production records, identities, passwords, allocations or job numbers were modified.

## Verification and acceptance

Seven new API regression tests reproduce the old failures and pass after the changes. The production frontend has thirteen browser checks covering HR and all three board roles, all nine marked services, saved reviews, travel sources, removal of inputs/calendar/external access and error retry. Native API regressions and production build are recorded in the separate local review evidence. Existing lint findings remain; no new findings were introduced.

The broad Node test glob includes container-spreadsheets.test.mjs, a Docker-specific harness requiring /app and an in-container fixture on port 5000. It cannot initialize in this native setup. All other native suites run separately. The original npm test Playwright command could not initialize because /tmp/designtree-local-fixture.json was absent; its legacy delivery flow also requires a dedicated seeded cast. Focused browser checks here use a separate disposable fixture instead. Docker, Windows and production acceptance are not claimed.

Deploy the delivered commit, verify historical records and role screens with the client, obtain the approved service-wise team list, then save the confirmed allocations through the authorized workflow. Company URL/database/server access was unavailable, so actual missing records remain unverified in the KG and Word report.
