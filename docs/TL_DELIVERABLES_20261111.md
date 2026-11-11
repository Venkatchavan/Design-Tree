# TL deliverables and log, 11 Nov 2026

Client feedback from the My team screens (Team Lead login):

| Feedback | Change |
|---|---|
| Remove the Deliverables tab under TL | The separate "Deliverables" tab (Add a project deliverable form) is gone for Team Leads on My team. The list of deliverables lives under **Assign work**. The project workspace view is unchanged. |
| Remove assign team | For Team Leads, Assign work no longer has the Assign Task form (team member checklist) or Work Assigned by Me. Work is given out per deliverable through the **Assigned to** column. ATD / TD views are unchanged. |
| The log should be visible to the entire project team | Every add, change and removal is written to the deliverables log (changes and removals were not logged before) with who made it. The log, and the current list with "Assigned to", is read-only for the whole team on **My work → Deliverables & Drawings** and on the project page's Deliverables tab. It refreshes every 15 seconds. |
| Align deliverables with the process manual | Stage is a dropdown of the six manual stages (Preliminary concept, Concept, Schematic, Design development, Tender, GFC). Deliverable is a dropdown of that stage's standard items, with "Other (specify)". "Add standard deliverables" fills a stage's full set. Older rows saved with CD / SD / DD / TD show under the matching stage. |

The process manual itself was not in the repository. The stage and deliverable names come from the reference prototype (`project-reference/Datum_dashboard_with_meetings.html`, `staffDeliverables`) and live in one file, `web/src/lib/processManual.js`. If the manual differs, edit that file.

The e2e scripts that drive the old TL Assign Task form (for example `e2e/tl-assignment-browser.mjs`) need updating for the TL flow.
