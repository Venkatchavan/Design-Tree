# DT Peer Review - 3 November 2026

Request: recreate the Structural Peer Review dashboard (`DesignTree_STR_PeerReview_Report_2026-11-03.docx`) as **DT Peer Review** under the left-nav Peer Review item. The Peer Review column under each project stays unchanged.

## Where it appears

- **Directors** (FD/WD/ED/AD/TD/ATD): Peer Review nav item → **DT Peer Review** tab (default). The old view is the **Peer review overview** tab. Read-only.
- **Peer Review Head / Peer Reviewers**: new nav item **DT Peer Review** (`/peer-review/dt`) below Dashboard. They create and maintain packages.
- Project scope: Peer Review logins see only projects of their Peer Review team. Directors see all projects.

## Report sections

The page follows the report: project block, 1 Package status (status, blockers and six KPIs), 2 Review team, 3 Review stage progress, 4 Approval gate, 5 Comments log (rounds) and 6 Master checklist. **Print report** prints the page.

## Rules (enforced by the API)

- A package is one per project. It is only for projects whose services include Structural (STR/SMEP/SMEPF) or Peer Review. It starts with S1–S7, the 25-item master checklist and the 7 deliverables from the report.
- Checklist status changes are stamped with the logged-in name and date. Items in a signed-off stage are locked.
- Comment rounds alternate as in the report. R1 is the DT comment, then the Principal Consultant response, then the next DT round marked COMMENT IS OPEN or COMMENT IS CLOSED.
- Only the Lead or Principal Engineer, or the Peer Review Head, can close a comment.
- A stage can be signed off only by the Lead or Principal Engineer. All its checklist items must be Verified or N.A., and it must have no open comments.
- Only the Principal Engineer, or the Peer Review Head, can approve a deliverable.
- Only the Principal Engineer can mark the package Released for Issue. This requires no open comments, all stages signed off and all approvals Approved or N.A. A released package is read-only.
- **Average closure time** = days from the R1 comment to the closing round. A comment is **Overdue** when the awaited reply is more than 7 days old (`DT_PR_RESPONSE_TARGET_DAYS`).

## Differences from the sample report

- **Items closed per stage** counts that stage's master-checklist items. The sample report's larger per-stage counts (e.g. S2 27/27) come from detailed stage checklists that were not supplied. Add items per stage with **Add item**.
- The review team is chosen from the employee list. Consultant responses are entered by the Peer Review team, because the Principal Consultant has no login.

## Verification

- `e2e/dt-peer-review.test.mjs`: 4 API tests covering scope, read-only directors, comment rounds, sign-off, approval and release rules.
- Full native suite: 164 tests, 161 pass. The 3 failures also fail on the baseline.
- Web build passes. Browser check against the local fixture at 1360px and 390px, as Peer Review Head and FD. No horizontal page scroll.


## 7 November 2026 changes (access and review team)

- **Admin allots the review team.** Arpitha D and Sandeep N (`DT_PR_ALLOTTER_EMAILS`) allot a Structural project to the review team: Veeshal Rathod V, T Anusha Chowdary and Mallappa S Maranur (`DT_PR_REVIEWER_EMP_IDS`). Allotting creates the package. They can change the team until the package is released, but cannot edit its content.
- **No team names are typed.** The review team no longer picks Design Engineer / Checker / Lead / Principal. The package shows the allotted team instead.
- **Review team works the package.** Only the allotted team (and the Peer Review Head) can edit details, update the checklist, raise comments, sign off stages, approve deliverables and release. The earlier Lead / Principal Engineer restrictions are gone because those roles no longer exist.
- **Read only for directors.** The log is read only for the Founding Directors and Srinivasa Rao (`DT_PR_VIEWER_EMAILS`). Working, Executive, Technical and Associate Technical Directors, and every other login, are refused (403) and do not see the DT Peer Review tab or nav item. Their existing Peer review overview is unchanged.
- **Navigation.** The DT Peer Review nav item is added per login (Admin allotters, Srinivasa Rao, allotted reviewers, Peer Review Head) instead of for every Peer Reviewer.
- **Login needed.** Review team members need a normal login linked to their employee record; they do not need the Peer Reviewer role.
