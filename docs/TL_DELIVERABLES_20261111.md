# TL deliverables and log, 11 Nov 2026

Client feedback from the My team screens (Team Lead login):

| Feedback | Change |
|---|---|
| Remove the Deliverables tab under TL | The separate "Deliverables" tab (Add a project deliverable form) is gone for Team Leads on My team. The list of deliverables lives under **Assign work**. The project workspace view is unchanged. |
| Remove "Assigned to" | The **Assigned to** column is removed from the List of deliverables. The Assign Task form and Work Assigned by Me stay under Assign work for Team Leads. |
| Add revised date with reason | Each deliverable has a **Revised date** and a **Reason for revised date** (the reason is required with the date). The original due date is kept. Team Leads can also use **Add a revised date** above the log. |
| The log should be visible to the entire project team | Every add, change, revised date and removal is written to the deliverables log with who made it. The log (Planned date, Project, Action, Stage, Deliverable, Due date, Revised date, Reason, By) and the current list are read-only for the whole team on **My work → Deliverables & Drawings** and on the project page. It refreshes every 15 seconds. |
| Align deliverables with the process manual | Stage is a dropdown of the six manual stages (Preliminary concept, Concept, Schematic, Design development, Tender, GFC). Deliverable is a dropdown of that stage's standard items, with "Other (specify)". "Add standard deliverables" fills a stage's full set. Older rows saved with CD / SD / DD / TD show under the matching stage. |

The process manual itself was not in the repository. The stage and deliverable names come from the reference prototype (`project-reference/Datum_dashboard_with_meetings.html`, `staffDeliverables`) and live in one file, `web/src/lib/processManual.js`. If the manual differs, edit that file.
