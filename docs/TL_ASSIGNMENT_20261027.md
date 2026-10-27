# TL assignment roster and job number 27 October 2026

The screenshot reports no team members in Assign Task and “Job number not recorded” for a project that the client says has a job number.

The non-director `/api/teams/mine` project population omitted jobNumber. It now returns the saved Project.jobNumber together with the existing project fields. The UI continues to show the absence label only when no jobNumber value was returned; it does not substitute the project code or generate a number.

The assignment form previously derived recipients only from the TL's own Team documents. A TL-only or empty nomination-derived Team could hide members already saved in another active Team for that same project, even though task creation already permitted those project members. The form now reads `/api/work/tasks/assignees?project=<id>`. The endpoint and task-write guard share the same project roster utility: active Teams, valid populated employee records and employees who have not exited. Existing director scope remains restricted through directorTeams. Project visibility and TL-chain role checks remain in place. The endpoint is read-only.

The TL picker omits lead-only rows, groups members by service and deduplicates employee IDs. It selects a single available project once asynchronous team data arrives, refreshes the selected project roster every ten seconds, resets selections on a user project switch and checks selections before task creation. Failures are shown with Retry team list; an empty saved roster explains that allocation is required. Assignment is disabled while loading, after errors, with no project or without a selected recipient.

A valid task still reaches the selected employee's My work. Members on inactive Teams, exited employees, unrelated projects and employees outside the authorized project roster cannot be assigned through this change.

This fix does not allocate arbitrary employees or write missing project rosters. Where the actual project has no confirmed team members, the SPOC or authorized team administrator must save the approved employee-backed allocation. Existing legacy nomination reconciliation remains available through its authorized explicit workflow; this read operation does not run a migration or infer name matches.

The client's exact database records and approved employee list are unavailable. The screenshot's saved job number and actual missing allocations were not inspected or modified. Deploy this commit, verify the job number and roster on the affected project, save any confirmed allocation that is genuinely absent and confirm task receipt with the TL and engineer. Previous approval policy, role assignments and delivery holds are unchanged.

Local verification covers saved job-number serialization, a TL-only empty Team alongside another saved project roster, task delivery, unrelated project/role denial, inactive/exited recipients, loading/error/retry and genuinely unallocated states. The full API and existing client browser regression results are retained in the local review evidence.
