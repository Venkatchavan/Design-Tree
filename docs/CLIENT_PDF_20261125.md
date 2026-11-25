# Client PDF, 25 Nov 2026

| # | Feedback | Change |
|---|---|---|
| 1 | HR travel: "Saved travel requests and booking summary" heading repeated | Heading and sub-line removed; the table stays. Employee names no longer show "undefined" when a last name is missing. |
| 2 | DT – Peer Review for the 6 designated users | The 3 designated reviewers (Veeshal Rathod V, T Anusha Chowdary, Mallappa S Maranur — `DT_PR_REVIEWER_EMP_IDS`) now always get the **DT Peer Review** nav item, even before a package is allotted; they see only packages allotted to them. **Sandeep N and Arpitha** (`DT_PR_ALLOTTER_EMAILS`) hold the approval authority: deliverable approvals and *Released for Issue* (the review team can no longer approve or release). Srinivasa Rao stays read-only. Nobody else sees the module. |
| 3 | Work Progress "Not yet updated" never changes | For a Team Lead it now counts team members who **signed in on the date but have not logged work** (follows attendance). It used to count the whole team, including absentees and people on leave, so it stayed at the team size (e.g. 45). |
| 4 | SPOC directory shows "Principal team lead — …" for everyone | Role / responsibility column removed. Each person's own **Designation** and **Experience** from the employee record are shown (screen and Excel). The service workspace directory shows Designation too. |
| 5 | SPOC Team allocation | Approval status field removed (new allocations are saved as Approved). Per-row Action column removed: tick rows in the list, then **Edit** / **Remove** next to *Record allocation*. Approval status column replaced by **Designation** (and Experience). |
| 6 | Repeated directory section | For a SPOC the allocation list carries the Directory service filter and **Download Excel**; the separate "In-house project team — all services" panel is no longer shown under it. Other roles still see the In-house panel. |
| 7 | Structural deliverables shown for every service | Deliverable dropdowns follow the service of the selected team members. Structural items appear only for Structural; other services get **Other (specify)** with free text until their lists are added to `web/src/lib/processManual.js` (`SERVICE_STAGE_DELIVERABLES`). |

## Open items

- **Engineer dashboard for reviewers**: Veeshal's login has the Peer Reviewer role, which opens the Peer Review dashboard. To get the Engineer dashboard plus DT Peer Review, his login role must be Engineer (Edit employee → role). T Anusha Chowdary and Mallappa S Maranur have no login yet; create them with the Engineer role.
- **MEP / Fire deliverables**: the process manual is not in the repository. Supply the HVAC, Electrical, Plumbing and Fire stage-wise lists to fill `SERVICE_STAGE_DELIVERABLES`.

## Verification

- `e2e/dt-peer-review.test.mjs`: 6/6 pass (updated for the new approval rule and designated-reviewer access).
- Web build passes; ESLint shows no new errors in the changed files (25 before, 25 after, all pre-existing).
- Browser scripts `client-updates-browser.mjs` and `directory-selectors-oct30-browser.mjs` were updated for the new allocation UI but not run (Playwright browsers are not installed on this machine).
