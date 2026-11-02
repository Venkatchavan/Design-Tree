# Client feedback - 2 November 2026 ("continued")

Base: `cde3561`, branch `dev/vishwa`. Reviewed all 13 pages.

| Page | Request | Result |
| --- | --- | --- |
| 1 | Remove the Project team table under SPOCs | Project detail → Documents → Project directory no longer renders the Project team table for coordinator logins. Other roles keep it. |
| 2 | Travel Booking only for HR, Founding Directors, Finance and the traveller | Company booking log + nav: HR, Founding Director, Finance. HR and Finance record bookings; FD is read-only. Any other internal login sees **My travel & hotel bookings** (own bookings only, read-only, no request log) only when it is the traveller on a saved booking. API enforces the same scope on list, get and summary. WD/ED Management and HR travel tabs no longer embed the booking log. |
| 3 | Remove Principal team leads / SPOC from Admin's New Project | Section, Excel team import and their payload fields removed. New projects notify Design Management (as before) and now also FD/WD/ED/AD/TD. Admin/TD activation on project detail is unchanged. |
| 4 | Design Management = Coordination; remove "All services / departments"; rename to Coordinators | SPOC picker's department dropdown is a single fixed **Coordinators** option listing every eligible coordinator login. |
| 5 | SPOC daily updates not reaching Design Management | Design Management heads now see every eligible coordinator and their daily entries, not only coordinators in their saved reporting line. Non-SPOC employees remain excluded. |
| 6, 7 | Teams not listed for ATD/TL; show Excel teams under TL / Sr TL | TL and ATD **Project & team** tab adds **My team (employee list)**: the saved reporting team (incl. "sees team of" links), grouped by reporting lead, with designation, department, experience and branch. Team members KPI counts project members ∪ reporting team. |
| 8 | Team leads column shows the whole team | Dashboard Team leads column and service panels' principal-lead fields show only rows marked as team lead (role-less legacy picks still show where a service has no marked lead). Duplicate names removed. |
| 9 | FD Finance → Project team empty | Tab now lists saved allocations per project × service: team lead, members (with designation) and size. Finance and WD can read the company directory for this. |
| 10, 11 | AD Teams / My team: filter-driven log, not the whole employee list; show experience and designation | Directory table replaced by **Project team log**. Empty until a department, project, member or search is chosen; then one row per project assignment with service, member (TL badge), designation, experience, branch and status. |
| 12 | Teams missing for TDs - respective departments only | Teams returns to the TD sidebar. TD company directory is limited to the TD's saved department plus `headOfDepartments`. A TD with neither sees an empty directory. |
| 13 | Remove Job number in AD/TD/ATD | Job number column removed from the team log. |

## Verification

- Native API tests: 159 total. 156 pass. 3 failures also fail on the baseline: the Docker-only spreadsheet test, and two generated-file checks that resolve `scripts/` relative to `e2e/`.
- Updated tests that encoded the superseded rules: travel access, DMH reporting-line-only SPOC scope, TD company-wide directory and TD's missing Teams entry. Added a traveller-scope test.
- Web production build passes. Changed files' ESLint count is unchanged from baseline (32), with no new findings.

## Open points

- Page 12 references a PPT for the TD department mapping that was not supplied. The scope uses each TD's saved department / `headOfDepartments`. Verify those values for live TDs.
- Pages 6/7 use the reporting links already imported from the employee list. People missing from a TL's team mean their `reportingManager` / "sees team of" link needs HR correction.
- "Founding Directors" was applied literally. Working/Executive Directors do not see the booking log unless they are travellers.
