# Client feedback - 3 November 2026

Base: `32466fe`, branch `dev/vishwa`. Reviewed all 6 pages.

| Page | Request | Result |
| --- | --- | --- |
| 1 | Retain one row and name it "Design Management Coordination" on every dashboard | `departmentLabel()` (`web/src/lib/services.js`) shows Design Management, Design Mgmt, Design Coordination and Coordination as **Design Management Coordination**. It applies to Management → HR login hours (per-employee and per-department tables), HR, Work Progress, Project Pulse, Finance, travel request log, meetings, reporting team, Design Management My Team and the recruitment department list. `serviceNames()` treats them as the same department, so grouping and filters merge too. Saved employee records are unchanged. |
| 2 | Design Management changes show on everyone's My Team; My Team is for the team under that Director / AD / TD / ATD / PTL | The bootstrap `designTeam` capability, which turns My Team into the SPOC dashboard, is now true only for the Design Management Head and TDs saved under Design Management. Founding and Working Directors get their own reporting-team My Team. Their API read access to the Design Management records is unchanged. |
| 3, 5 | Some team lead names missing (e.g. Umakanth) in SPOC Team allocation | Team-lead candidates were only `team_lead` logins. They now also include ATD logins and any active employee with a saved Team Lead / Sr / Principal TL, "Lead - …" or Associate Technical Director designation, with or without a login. Each lead still brings their saved reporting team. |
| 4 | Stage on TL Assign task should be a dropdown per the process manual | Free-text field replaced by a dropdown: Preliminary concept, Concept, Schematic, Design development, Tender, GFC. This is the same list engineers log against. |
| 6 | "Project not found" when a SPOC puts a project On Hold | Hold save required an *approved* SpocAllocation row, so projects where the SPOC is set as the project's current SPOC (`activation.spoc`) failed. The current project SPOC can now hold the project. Without one, an active approved allocation is still required. A merely proposed SPOC is still refused. |

## Open points

- Page 4: the process manual was not supplied. The six-stage list already used across the app was applied. Send the manual's stage names if they differ.
- Pages 3/5: people with a lead designation but no login appear as candidates. A lead whose team is empty needs `reportingManager` links corrected by HR.
- Page 1: Krishna M's row ("—") has no saved department. HR should fill it in.

## Verification

- Native API tests: 160 total. 157 pass. The 3 failures also fail on the baseline: the Docker-only spreadsheet test, and two generated-file checks that resolve `scripts/` relative to `e2e/`. Added a test for a current project SPOC holding without an allocation row.
- Web production build passes.
