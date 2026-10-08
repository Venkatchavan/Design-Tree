# PROJECT INITIATION & EXECUTION WORKFLOW

Admin -> Design Management Head -> SPOC -> Project Execution -> GFC Submission

Click-by-click frontend walkthrough with exact values. Doubles as a
**completeness test**: every step tells you where to click, what to type,
which button to press, and what you must see. If all scorecard rows (§11)
pass with the values below, the system is complete for this workflow.

Button, tab, panel and field names below are the literal on-screen labels.

---

## §0 READ THIS FIRST - sign-in, sign-out, judging rule

**S0.1 Open the app.** You land on the sign-in screen titled
`Sign in to DesignTree` with the line
`Enter your work email and password to continue.`

**S0.2 Sign in.** Click inside the `Work email` field, type the email.
Click inside the `Password` field, type the password. Click the
`Sign in` button (it briefly reads `Signing in...`).

**S0.3 Sign out (between EVERY role below).** Look at the dark left sidebar,
bottom: your avatar initials, name and role. Click the **LogOut icon**
at the far right of that footer row. You return to the sign-in screen.
Note: Engineer/Drafter and Coordinator must have today's work hours logged,
or sign-out bounces them to the hours entry with
`Man-hour entry is mandatory before you sign out.`

**S0.4 Start state.** Seeded Founding Director only, empty database.
Sign in first as `founding.director@designtree.com` (seed password).

**S0.5 Password for all 11 test logins you will create:** `Test@1234`
(login schema needs minimum 8 characters).

**S0.6 Judging rule.** A step passes ONLY if the stated on-screen result
appears (table row, toast at the bottom, KPI number change, badge). Tick
each row in §11 as you go.

---

## §1 CAST CREATION - FD creates all logins (HR -> Employee management)

Stay signed in as Founding Director.

**S1.1 Go there.** In the left sidebar click `HR`. At the top click the
`Employee management` tab. You see a filters row (search box, `All branches`,
`All departments`, `All statuses` dropdowns) and an `Add employee` button.

**S1.2 Open the form.** Click `Add employee`. A wide modal titled
`Add employee` opens with heading `Payroll form - all sections`.

**S1.3 Create person #1 fully (template for all).** Fill these fields
(all required - the form refuses to save without Date of joining):

- Identity section: `Emp ID` = leave blank (auto) · `First name` = `Vikram` ·
  `Last name` = `Rao` · `Designation` = `Administrator` ·
  `Department` = `Admin` · `Branch` = `Bengaluru HQ` ·
  `Date of joining *` = `2023-04-01`.
- Scroll to `Login (restricted)`: `Login email` =
  `admin@designtree.test` · `Password` = `Test@1234` · `Role` dropdown =
  `Admin / Billing`.
- Click `Save employee` (reads `Saving...`, then the modal closes).

**Expected:** the directory table gains a row `Vikram Rao` with a status
pill; Overview headcount rises.

**S1.4 Repeat for the other 10.** Click `Add employee` again each time.
Same clicks, new values (DOJ / email / role change; rest analogous):

| # | First / Last | Designation | Department | DOJ | Login email | Role dropdown |
|---|---|---|---|---|---|---|
| 2 | Divya Nair | Design Management Head | Design Management | 2023-04-01 | `design.head@designtree.test` | Design Management Head |
| 3 | Arjun Reddy | Team Lead, Structural | Structural | 2023-06-01 | `tl.struct@designtree.test` | Team Lead (TL) |
| 4 | Ananya Rao | Coordinator (SPOC) | MEP Coordination | 2023-06-01 | `spoc@designtree.test` | Coordinator (SPOC) |
| 5 | Karthik Nair | Senior Structural Engineer | Structural | 2024-01-10 | `eng.struct@designtree.test` | Engineer / Drafter |
| 6 | Meera Shetty | Mechanical Designer | Mechanical | 2024-02-01 | `eng.mech@designtree.test` | Engineer / Drafter |
| 7 | Deepa Kulkarni | QS Lead | QS | 2023-08-01 | `qs@designtree.test` | QS |
| 8 | Ravi Menon | QA/QC Lead | QA/QC | 2023-08-01 | `qa@designtree.test` | QA/QC |
| 9 | Nikhil Joshi | BIM Lead | BIM | 2024-01-05 | `bim@designtree.test` | BIM |
| 10 | Suresh Babu | Client PM | Client | 2024-01-05 | `client@designtree.test` | Client |
| 11 | Asha Verma | Architect | Architect | 2024-01-05 | `arch@designtree.test` | Architect |

Password `Test@1234` for all. Branch `Bengaluru HQ` for 1-9.

**Expected:** directory shows 11 + FD; filter `All statuses` lists everyone.
Click any row → read-only `Employee profile` modal (Name, Emp ID,
Designation, Department, Branch, Date of joining, Email, Mobile, Status +
Linked login Email/Role/Active). Close with the X.

**S1.5 Sign out** (sidebar footer LogOut icon).

---

## §2 ADMIN - CREATE NEW PROJECT (sign in as `admin@designtree.test`)

**S2.1 Go there.** Sidebar now shows admin pages. Click `Dashboard`
(or `Projects`). Click the `New project` button (top right).

**S2.2 Fill Information (required fields marked * - blanks give 400):**
`Project name *` = `Sunrise Heights Tower A` · (code field) = `DT-2601` ·
`State *` = `Karnataka` · Project Type = `Residential` · `Branch *` =
`Bengaluru HQ` · Used For = `Residential Apartments` ·
Entity Name = `DesignTree Consultants Pvt Ltd` ·
Project Location label = `Survey No 45, Whitefield, Bengaluru` ·
City = `Bengaluru` · Zip = `560066` · Job Number = `JOB-2601`.

**S2.3 Scope of Work & Fee - add 5 rows:**
Structural / `RCC framed structure design` / `1200000` ·
Mechanical / `HVAC design` / `600000` ·
Electrical / `Electrical and ELV design` / `550000` ·
Plumbing / `PHE design` / `350000` ·
Fire / `Fire fighting design` / `300000`.

**S2.4 Contacts:** Client Name `Suresh Babu`, Company `Lakeside Developers`,
Email `client@designtree.test`, Phone `+91-98450-00001` · Architect
`Asha Verma`, `Studio AV`, `arch@designtree.test` · PMC Email
`pmc@shreya.test` · Billing contact = client values.

**S2.5 Related User:** Project Director = `Founding Director`,
designation `Founding Director` · Project Head = `Divya Nair`,
designation `Design Management Head`.

**S2.6 Principal team leads:** Structural = `Arjun Reddy` ·
Mechanical = `Meera Shetty`.

**S2.7 Save.** Click `Save` (or `Save & New` if adding more).

**Expected:** the new Project Detail page opens for `DT-2601`;
click `Back to dashboard` → the projects table lists `Sunrise Heights
Tower A (DT-2601)`, Active; status cards Active +1.

**S2.8 Sign out.**

---

## §3 DESIGN MANAGEMENT HEAD - RECEIVES & REVIEWS (sign in as `design.head@designtree.test`)

**S3.1** Sidebar → `Design Management` (design-mgmt home). Open the project
(`DT-2601` row → click).

**S3.2** Click through tabs: `Overview` (verify details, contacts, 5-row
scope with the §2.4 fees), `Coordination`, `RFI's`, `Meetings`,
`Deliverables & drawings`, `Revision logs`. Confirm required services =
Structural, Mechanical, Electrical, Plumbing, Fire.

**Expected:** no errors; scope/fees match §2. Note team needs back to Admin:
Structural, Mechanical, Electrical, Plumbing, Fire, BIM, QA/QC, Peer Review,
QS (executed in §4-§5).

**S3.3 Sign out.**

---

## §4 PROJECT TEAM FINALISATION - 3 teams + members

**READ FIRST - verified UI fact:** the `Teams` page is cards-only
(`No teams yet.` + clickable cards, NO Create button). Team creation exists
only as `POST /api/teams`. So this section has one API step (run once,
signed in as Admin - use the browser devtools console on any page, or
Compass/API client with the admin cookie), then everything continues in UI.

**S4.1 Create the 3 teams (one API call each, admin session).**
POST `/api/teams` three bodies (replace LEAD_ID / PROJECT_ID with the real
ids from the employee directory and `DT-2601`):

1. `{"name":"Structural Design","service":"Structural","branch":"Bengaluru HQ","lead":"<Arjun-emp-id>","projects":["<DT-2601-id>"],"members":[{"employee":"<Arjun-emp-id>"},{"employee":"<Karthik-emp-id>"}]}`
2. `{"name":"Mechanical Design","service":"Mechanical","branch":"Bengaluru HQ","lead":"<Meera-emp-id>","projects":["<DT-2601-id>"],"members":[{"employee":"<Meera-emp-id>"}]}`
3. `{"name":"MEP Coordination","service":"MEP Coordination","branch":"Bengaluru HQ","lead":"<Ananya-emp-id>","projects":["<DT-2601-id>"],"members":[{"employee":"<Ananya-emp-id>"},{"employee":"<Meera-emp-id>"}]}`

**S4.2 Verify in UI (still Admin).** Sidebar → `Teams`: 3 cards with member
counts. Click each card → Team detail → `Edit allocations` button →
`Add member - search employees` field: type a name, click the result row,
set `Alloc %` if needed → `Save members` button → members table updates.

**Expected:** 3 team cards; each detail lists its members with
designation/department. (Record finding F-01: no Create-team UI.)

---

## §5 SPOC ALLOCATION → PROJECT ACTIVATION (sign in as `spoc@designtree.test`)

**S5.1 Go there.** Sidebar → `My coordination`. Click the
`Project Directory` tab. Find the `Record allocation` panel.

**S5.2 Fill:** `Project` dropdown → select
`DT-2601 - Sunrise Heights Tower A` · `Coordinator` dropdown → select
`Ananya Rao` · `Services` checkboxes → tick Structural, Mechanical,
Electrical, Plumbing, Fire. Click `Record allocation`.

**Expected:** saved (allocation status Approved); click the `Overview` tab →
subtitle reads `1 allocated project(s)`; the project card shows client,
stage, team, status. The project is Active and the SPOC workspace is live -
this is the "Admin activates project and assigns confirmed SPOC" step.

---

## §6 SPOC - DIRECTORY & ACCESS CHECK

**S6.1** In `My coordination` → `Overview`, click the `DT-2601` project
pill → verify Client, Stage, Team, Status, Branch fields.

**S6.2 Portal access (Admin grants portal users on the project; verify here).**
Sign out. Sign in as `client@designtree.test` → sidebar shows ONLY
`Project Portal` → only `DT-2601` visible. Sign out. Sign in as
`arch@designtree.test` → same. Sign out. (Full portal flow in §10.)

---

## §7 SPOC WORKFLOW - meetings, MOM, actions, coordination, RFI, revision

Sign in as `spoc@designtree.test` → `My coordination` → `Meetings` tab
(5 tabs: `Dashboard`, `All meetings`, `Action items`, `Absence log`,
`Project history`). Top right: `+ Schedule Meeting`, `+ Add Sudden Meeting`.

**S7.1 Schedule.** Click `+ Schedule Meeting`. In the modal:
`Project` → `DT-2601 - Sunrise Heights Tower A` (watch the teal
`Responsible: ... SPOC (SMEPF services)` banner load) · `Meeting type` →
`Client / DRM` · `Meeting title / subject` → type
`Weekly DRM review, Week 1` · `Meeting date` → tomorrow's date ·
`Start time` → `11:00` · `End time` → `12:00` · `Meeting mode` →
`Online` · `Meeting link` → `https://meet.example.com/drm-wk1` ·
`Meeting conducted by` → `Client` · `External participants` → type
`Suresh Babu (Client PM)` · `Services discussed` → keep all 6 chips ticked ·
`Meeting agenda / purpose` → type
`Kickoff DRM: scope freeze, drawing list sign-off` ·
`Project team members` → keep all ticked (live count shown) · click
`Schedule meeting`.

**Expected:** toast at bottom:
`Meeting scheduled. Invitations sent to N team members.`

**S7.2 Sudden.** Click `+ Add Sudden Meeting`. Same project. `Meeting title` →
`Shaft S3 clash resolution`. `Reason for the sudden meeting` → type
`Duct vs beam clash reported on site` (mandatory). Select
`Meeting is over: record attendance and MOM now`. Save (`Save sudden meeting`).

**Expected:** toast `Sudden meeting saved.` and the right slide-over details
panel opens with the 6-step tracker (Planned/Conducted/Attendance/MOM/
Action items/Tracked).

**S7.3 Hold + attendance + MOM (open the Week-1 meeting row).**
Click `Mark meeting held` → toast `Marked as held...`. In `Attendance`:
for one member click `Not attended` → the `Reason for absence` field appears
under them → type `On site visit at Whitefield` → click `Save attendance`
(header shows `4/5 attended`-style count). In `Minutes of meeting`: type
discussion `Shaft sizes frozen at 150 mm`, decisions
`Issue revised shaft section`, follow-up `Architect to confirm shaft closure`,
`Next / follow-up meeting` → +7 days → `Save MOM`.

**S7.4 Action items.** In the panel: `Action / task` →
`Issue revised shaft section` · `Responsible person` → Karthik Nair
(service auto-fills Structural) · `Priority` → High · `Target date` → +7 days
→ `Add action item` (toast `Action item assigned to Karthik Nair.`).
Add a second: `Update electrical load sheet` → Meera Shetty, Medium, +7 days.

**S7.5 Coordination + RFI + revision (project detail page).**
Open `DT-2601` → `Coordination` tab → log item (Channel `Site`, Service
`Mechanical`, Topic `Shaft S3 clash`, Deadline +3 days). → `RFI's` tab →
log RFI (Type `Technical`, Description
`Confirm UPS load figures for load sheet`, Team Structural, Due +5 days). →
`Revision logs` tab → log revision (Service Structural, Stage DD, Reason
`Beam depth capped at 750 mm`).

**Expected dashboard proof** (`Meetings` → `Dashboard` tab): Total 2,
Scheduled 1, Sudden 1, Upcoming 1, Pending action items 2, Absences recorded
1; `Alerts & reminders` lists the Week-1 meeting; `All meetings` row shows
the Responses summary (`1 available...`-style) and attendance; `Absence log`
holds the Whitefield row WITH reason; `Project history` (select DT-2601)
lists both meetings in date order with client/scope/responsible header.

---

## §8 EXECUTION - engineers, TL, functions

**S8.1 Engineers.** Sign out. Sign in as `eng.struct@designtree.test` →
`My work` → `Meetings` tab → invitation card → click `Available` →
`Send response`. `Update progress` tab → `Projects under my PTL` (or Active
projects) → select `DT-2601` → `Hours *` → `4` → Remarks
`Shaft section rework` → `Submit for team lead action`. Sign out. Sign in as
`eng.mech@designtree.test` → Meetings → invitation → `Not available` →
`Reason` → `Client engagement` → note `can join after 4 PM` →
`Send response`. `My action items` → status dropdown → `In Progress` → type a
progress note → save. Sign out.

**Expected (verify back as SPOC):** panel `Availability responses` shows
Available + Not-available-with-reason; action row shows the progress note.

**S8.2 TL.** Sign in as `tl.struct@designtree.test` → `My team` →
`Monitoring`/`Awaiting response`: review submitted entries; `Assigned to me`
table → per task `Acknowledge`, then `Start`, then `Submit`. Sign out.

**S8.3 Functions.** Sign in as `qs@designtree.test` → `Work tracking` →
QS `Log work update` (select work type, describe BOQ item) → submit. Sign out.
`qa@designtree.test` → Work tracking → `Log site visit`. Sign out.
`bim@designtree.test` → Work tracking → clash log entry. Sign out.

**Expected:** each Work Tracking page lists its entry; SPOC Overview alerts
clear as items are handled.

---

## §9 APPROVAL, TRANSMITTAL, BILLING, CERTIFICATES, PORTAL, HR

**S9.1 Revision approval.** As TL/Director (My Team → `Revision log` /
Work Tracking review queue): move the §7.5 revision In Progress → Submitted
→ Approved. **Expected:** status pills change; awaiting queues empty.

**S9.2 Transmittal (Admin → `Transmittal`, TL lists feed it).**
Create entries from the TL drawing list for a GFC-stage drawing; set status
Sent, then Acknowledged. **Expected:** company `Transmittal Log` rows visible
to TL/Coordinator roles.

**S9.3 Billing (Vikram → `Billing` → `Claims` tab → `Enter new billing
details` panel).** `Project *` → `DT-2601` · `Stage *` → type `GFC` ·
`Amount (Rs) *` → `500000` · `Submission date` → today → click
`Submit billing entry`. In the claims table click `Mark billed` on that row.
**Expected:** Billed totals rise; Stage tracker readiness reads Billed.

**S9.4 Certificates.** Issue the completion certificate for `DT-2601`.
**Expected:** listed under Completion Certificates.

**S9.5 Client portal (Suresh).** Sign in → `Project Portal` →
`Drawings & submissions` tab → `Acknowledge receipt` panel →
`Drawing (unacknowledged)` dropdown → pick the GFC drawing → `Remarks` →
optional → `Confirm received`. `Pending requests` tab → respond to the UPS
request. Sign out. **Architect (Asha):** same two checks. Sign out.
**Expected (as SPOC):** acknowledgements/responses visible.

**S9.6 Leave (Meera → `Leave & Travel` → `Leave request` tab).**
Type `Casual Leave`, From +5 days, To +6 days, Reason `Family function` →
`Submit leave`. Sign out. Approve as HR/Admin: `Approvals` tab → row buttons
`Approve`. **Expected:** status Approved; Meera's bell shows the decision.

**S9.7 Support (Karthik → `Employee support` → `Queries` tab).**
Subject `Payslip correction`, details one line → `Submit`. Verify in the
support queue. Sign out.

**S9.8 GFC SUBMISSION.** Final GFC drawing set transmitted (Transmittal,
stage GFC) + closing-DRM MOM recorded (§7.3 pattern). Project moves toward
Completed with the certificate issued (§9.4).

---

## §10 COMPLETENESS SCORECARD (pass = exact expected text/row seen)

| # | Screen + control | Expected | Pass |
|---|---|---|---|
| 1 | HR `Add employee` x11 | 11 rows; all sign in | [] |
| 2 | Row click `Employee profile` | All fields + Linked login shown | [] |
| 3 | Dashboard `New project` + Save | Detail opens; Active +1 | [] |
| 4 | DM tabs | Scope/fees match §2, no errors | [] |
| 5 | Teams (API create) + `Save members` | 3 cards, counts correct | [] |
| 6 | Directory `Record allocation` | Overview `1 allocated project(s)` | [] |
| 7 | Portal (client/architect) | Only DT-2601 visible | [] |
| 8 | `+ Schedule Meeting` | Toast `Meeting scheduled. Invitations sent to ...` | [] |
| 9 | `+ Add Sudden Meeting` | Toast + held panel, reason stored | [] |
| 10 | `Mark meeting held` | Attendance/MOM unlock | [] |
| 11 | `Not attended` + reason + `Save attendance` | Count + Absence log row | [] |
| 12 | MOM `Save MOM` | Clears `Completed - MOM pending` | [] |
| 13 | `Add action item` x2 | Tab badge = 2; assignees see them | [] |
| 14 | Coordination log save | Row on Coordination tab | [] |
| 15 | RFI save | Row with due + status | [] |
| 16 | Revision log save | Row by service | [] |
| 17 | `Available` / `Not available` + `Send response` | SPOC sees both + reason + note | [] |
| 18 | `Submit for team lead action` | TL queue shows entry | [] |
| 19 | Task `Acknowledge/Start/Submit` | Status pills change | [] |
| 20 | QS/QA/QC/BIM log entries | Each Work Tracking lists its row | [] |
| 21 | Revision → Approved | Queues clear | [] |
| 22 | Transmittal Sent→Acknowledged | Company log rows | [] |
| 23 | `Submit billing entry` + `Mark billed` | Totals + readiness update | [] |
| 24 | Certificate issued | Listed | [] |
| 25 | `Confirm received` + request response | SPOC sees both | [] |
| 26 | `Submit leave` + `Approve` | Approved + bell for Meera | [] |
| 27 | `Queries` + `Submit` | Queue shows ticket | [] |
| 28 | GFC set + closing MOM | History complete, certificate issued | [] |

**Rule:** all 28 pass with the values above → complete. Log failures as:
role, screen, button, exact error text.

## Appendix F - Findings (fill during the run)

- **F-01:** No Create-team UI (`Teams` page is list-only; creation is API-only
  `POST /api/teams`). Workaround used: §4. Record for backlog.
- F-02: ...
