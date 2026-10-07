# REQUIREMENT.md

# DesignTree / Datum --- Consolidated Functional Requirements

**Source date:** 7 October 2026\
**Source documents:** Datum Dashboard Documentation, SPOC Meetings
Module Documentation, Employee Meetings Module Documentation.

## Purpose

This file consolidates the supplied functional documentation into a
single implementation reference. The source documents define the current
Datum dashboard, its roles/modules/workflows, and the complete SPOC and
Employee Meetings behaviour.

### Source-of-truth rules

1.  Preserve the business terminology, role names, workflows, statuses,
    validations and permissions defined in the source documents.
2.  Prototype/demo behaviour must not be mistaken for production
    behaviour.
3.  Where the source explicitly identifies a prototype limitation or
    production recommendation, keep that distinction.
4.  No new business rule is silently invented in this consolidation.
5.  The three source specifications are included below in full,
    converted from DOCX into Markdown; tables are preserved as Markdown
    tables where possible.

## Consolidated system scope

The system is a role-based workspace for DesignTree Service Consultants
covering project delivery, coordination, QA/QC, quantity surveying, BIM,
green-building certification, peer review, HR, finance, billing,
marketing, client communication, transmittals, work tracking, and
meetings.

The meetings subsystem consists of: - **SPOC Meetings** --- meeting
ownership, scheduling, participant selection, availability, attendance,
MOM, action items, alerts, absence log and project history. - **Employee
Meetings / My Meetings** --- employee invitations, availability
responses, meeting history, MOM viewing/download and personal
action-item tracking.

## Core terminology

-   **TL / PTL** --- Team Lead / Principal Team Lead.
-   **SPOC** --- Single Point of Contact / Coordinator.
-   **GFC** --- Good For Construction; final drawing stage and the stage
    at which transmittals are issued.
-   **TR** --- Transmittal.
-   **RFI** --- Request for Information.
-   **BOQ** --- Bill of Quantities.
-   **MOM** --- Minutes of Meeting.
-   **WU** --- Work Update.
-   **QA/QC** --- Quality Assurance / Quality Control.
-   **BIM** --- Building Information Modelling.
-   **GBS** --- Green Building Services.
-   **PHE** --- Public Health Engineering.
-   **PMC** --- Project Management Consultant.
-   **OCC** --- Operations Control Centre.

## High-level implementation areas

The implementation must cover, at minimum, the following source-defined
areas:

1.  Authentication/sign-in and role-scoped navigation.
2.  Projects dashboard and project detail.
3.  New project and project/team setup.
4.  Billing and completion certificates.
5.  Teams and HR.
6.  Work progress and mandatory daily man-hours.
7.  Company transmittal log and Admin transmittal management.
8.  Design Management.
9.  Marketing.
10. Management & Leadership.
11. Finance and Finance sub-pages.
12. Client / Architect Project Portal.
13. Leave & Travel.
14. Employee Support.
15. Org Structure & Policy.
16. My Team.
17. My Coordination.
18. My Work.
19. Function workspaces: QS, QA/QC, BIM, GBS, Peer Review.
20. Function-head dashboards.
21. Department dashboards: Structural, Mechanical, Electrical, PHE,
    Fire.
22. SPOC Meetings.
23. Employee Meetings / My Meetings.
24. Notifications, alerts, approvals, audit-relevant status changes and
    workflow history.

------------------------------------------------------------------------

------------------------------------------------------------------------

# Datum Dashboard --- Complete Functional Documentation

DesignTree

Datum Dashboard

Complete Functional Documentation

Sections, modules, navigation, fields, workflows and role permissions

Version: current build (includes Transmittal, My work and SPOC daily
update changes)

Date: 7 October 2026

Prepared for: DesignTree

# Contents

1.  Introduction

1.1 Purpose of this document

1.2 What Datum is

1.3 How the dashboard is built

1.4 How to read this document

2.  Application Layout and Common Behaviour

2.1 Sign-in screen

2.2 Left navigation bar

2.3 Top bar

2.4 Page conventions

2.5 Notifications

2.6 Mandatory daily man-hours and sign-out

2.7 Role access enforcement

3.  User Roles and Access

3.1 Roles in the dashboard

3.2 What each group of roles is for

3.3 Access rules

3.4 Level and approval policy (from the Org Structure & Policy page)

4.  Modules and Dashboards

4.1 Projects (Dashboard)

4.2 Project Detail

4.3 New Project

4.4 Billing

4.5 Completion Certificates

4.6 Teams

4.7 HR

4.8 Work Progress

4.9 Transmittal Log (company register)

4.10 Transmittal (Admin)

4.11 Design Management

4.12 Marketing Dashboard

4.13 Management & Leadership Dashboard

4.14 Finance Dashboard

4.15 Finance sub-pages

4.16 Client Portal

4.17 Leave & Travel

4.18 Update Work Progress

4.19 Employee Support

4.20 Org Structure & Policy

4.21 My Team (Team Lead / Principal Team Lead)

4.22 My Coordination (Coordinator / SPOC)

4.23 My Work (Engineer / Drafter)

4.24 Function Workspaces: QS, QA/QC, BIM, GBS and Peer Review

4.25 Function Head Dashboards

4.26 Department Dashboards: Structural, Mechanical, Electrical, PHE,
Fire

5.  Key Workflows

5.1 Project creation to team set-up

5.2 Assigning work and updating progress

5.3 Revision handling

5.4 Drawing issue and transmittal (GFC)

5.5 Daily man-hours and sign-out

5.6 Leave, travel and approvals

5.7 Employee support

5.8 Billing and completion certificates

5.9 Recruitment

5.10 QA/QC site visits

6.  Recent Changes Included in This Version

7.  Technical Notes and Limitations

Appendix A. Navigation by Role

Appendix B. Demo Sign-in Quick Reference

Appendix C. Glossary

# 1. Introduction

## 1.1 Purpose of this document

This document describes the Datum dashboard as it currently exists,
including all updates made up to the version supplied for this review.
It is written so that a reader can understand what every section of the
dashboard is for, who can use it, what information it shows or captures,
and how the main workflows operate, without having to open the dashboard
side by side.

## 1.2 What Datum is

Datum is a role-based workspace for DesignTree Service Consultants, a
structural, MEP (mechanical, electrical, plumbing/PHE, fire) and design
consultancy. It brings project delivery, coordination, QA/QC, quantity
surveying, BIM, green-building certification, peer review, HR, finance,
billing, marketing and client communication into one place. Each person
signs in with a role and sees only the navigation, tabs and data that
role is meant to use.

## 1.3 How the dashboard is built

Single self-contained web page (one HTML file). It runs entirely in the
browser; there is no server or database behind it.

Demo data. The dashboard is populated with sample projects, people,
drawings, bills and requests (for example "Business park - Tower A",
"Cambridge court residences", "Whitefield tech campus"). Anything a user
adds or changes is held in the browser session only and is lost when the
page is reloaded.

External libraries. Charts use Chart.js and Excel import/export uses
SheetJS (both loaded from a CDN), and fonts load from Google Fonts.
Without internet access, charts do not draw and Excel export falls back
to CSV where a fallback exists.

Emails and notifications. Notifications appear in the in-app bell. Email
notifications generated by the dashboard (for example for revisions) are
recorded as "Queued" with a ready-made mail link; a real mail service
can be connected through the optional setting
`window.DATUM_MAIL_ENDPOINT`.

## 1.4 How to read this document

Chapter 2 explains the common screen layout and behaviours that apply to
every user.

Chapter 3 lists all 26 user roles, what each can see, and the access
rules.

Chapter 4 documents every module/dashboard one by one: purpose, who uses
it, tabs, summary figures, fields, tables, actions and rules.

Chapter 5 follows the main business workflows end to end across modules.

Chapter 6 records the recent changes included in this version. Chapter 7
lists known limitations. Appendices give the navigation per role, demo
sign-in accounts and a glossary.

  -----------------------------------------------------------------------
  Terminology. TL / PTL = Team Lead / Principal Team Lead. SPOC = Single
  Point of Contact (the Coordinator). GFC = Good For Construction. TR =
  Transmittal. RFI = Request For Information. BOQ = Bill of Quantities.
  SMEP = Structural, Mechanical, Electrical, Plumbing/PHE and Fire.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

# 2. Application Layout and Common Behaviour

## 2.1 Sign-in screen

The dashboard opens on a sign-in page for "Datum" with a short
description of the product ("Multi-disciplinary structural, MEP and
design consultancy").

  -----------------------------------------------------------------------
  Item                                Description
  ----------------------------------- -----------------------------------
  Work email / Password               Standard sign-in. A wrong
                                      combination shows the message "That
                                      email and password don't match our
                                      records. Try again, or use quick
                                      demo access below."

  Demo password                       A single shared demo password is
                                      printed on the sign-in screen for
                                      every account. A "Forgot password?"
                                      link is shown but is not wired to a
                                      reset process.

  Quick demo access                   Buttons grouped as: Board &
                                      Leadership (Founding Director,
                                      Working Director, Executive
                                      Director); Directorate (Associate
                                      Director, Technical Director,
                                      Assoc. Technical Director); Admin,
                                      HR & Finance (Admin / Billing, HR,
                                      Finance); Project Delivery (TL,
                                      Engineer / Drafter, Coordinator
                                      (SPOC)); Departments - Design
                                      Management, QA/QC, QS, BIM, GBS and
                                      Peer Review, each with a Head
                                      button and a Team button;
                                      Marketing; and External users
                                      (Client, Architect). Clicking a
                                      button signs in as that role
                                      without typing credentials.

  After sign-in                       Each role lands on its own home
                                      page (see Chapter 3).
  -----------------------------------------------------------------------

## 2.2 Left navigation bar

The dark blue sidebar carries the Datum logo and the list of pages the
signed-in role may open. The list differs by role (full list in Appendix
A). The current page is highlighted. At the bottom are the signed-in
person's initials, name and designation and a sign-out button.

The navigation items that exist in the dashboard are:

  --------------------------------------------------------------------------------------
  Navigation item         Opens                   Roles that see it
  ----------------------- ----------------------- --------------------------------------
  Dashboard / Projects    Company project         Founding & Working Director, Executive
                          dashboard (home for     Director, Associate Director,
                          board roles)            Technical Director, Assoc. Technical
                                                  Director, Admin, HR, TL, Coordinator,
                                                  QA/QC

  Billing                 Claims, stage tracker,  Founding & Working Director, Admin,
                          delay tracker, quoted   Executive Director
                          fee                     

  Completion Certificates Issued certificates,    Directors, Admin, HR,
                          templates, client       Executive/Associate/Technical/Assoc.
                          uploads                 Technical Director

  Teams                   Team rosters and weekly Directors, Admin,
                          approval                Executive/Associate/Technical/Assoc.
                                                  Technical Director, HR

  HR                      HR module               Founding & Working Director, HR,
                                                  Executive Director

  Work Progress           Organisation-wide daily Directors, TL,
                          activity                Executive/Associate/Technical/Assoc.
                                                  Technical Director

  Transmittal Log         Company transmittal     Directors,
                          register                Executive/Associate/Technical/Assoc.
                          (read-oriented, scoped  Technical Director, TL,
                          by role)                Engineer/Drafter, Coordinator, HR,
                                                  QA/QC (not shown to Admin)

  Transmittal             Admin transmittal       Admin only
                          management (new)        

  Design Management       Coordination,           Directors,
                          deliverables and RFI    Executive/Associate/Technical/Assoc.
                          tracking                Technical Director, Design Management
                                                  Head

  Marketing Dashboard     Portfolio, collateral   Founding & Working Director, Marketing
                          requests, contacts      

  Finance Dashboard,      Finance module pages    Founding & Working Director, Executive
  Finance Operation                               Director, Finance (Travel Booking and
  Control Center (OCC),                           Billing Status are also shown to
  Travel Booking, Revenue                         Associate/Technical/Assoc. Technical
  & Financial Reports,                            Director)
  Billing Status                                  

  QA/QC Specifications,   Department-head         Directors,
  BIM, GBS, Peer Review,  dashboards              Executive/Associate/Technical/Assoc.
  QS                                              Technical Director and the respective
                                                  department head

  Structural, Mechanical, Company-wide department Founding & Working Director,
  Electrical, PHE, Fire   dashboards              Executive/Associate/Technical Director

  Project Portal          External client /       Client and Architect only
                          architect portal        

  Update Work Progress    Daily work and hours    Most internal roles - not shown to
                          entry                   Engineer/Drafter or Coordinator, whose
                                                  entry now lives inside My work / My
                                                  coordination

  Leave & Travel          Leave, travel, local    All internal roles
                          allowance / cab         
                          requests, approvals     

  Employee support        Salary slip, complaint  All internal roles except Finance
                          box, suggestions,       
                          queries                 

  Management & Leadership Consolidated leadership Founding & Working Director,
  Dashboard               dashboard               Executive/Associate/Technical Director

  My team                 Team Lead workspace     TL, Associate Technical Director
                          (called "My projects    
                          and team" on the page)  

  My coordination         Coordinator (SPOC)      Coordinator
                          workspace               

  My work                 Engineer/Drafter        Engineer / Drafter
                          workspace               

  Work tracking           Service work tracking   QS, QA/QC, BIM, GBS, Peer Reviewer

  Settings                Placeholder entry (no   Admin
                          screen behind it yet)   
  --------------------------------------------------------------------------------------

## 2.3 Top bar

Breadcrumb on the left shows where the user is (for example "Dashboard",
or "Dashboard / Business park - Tower A" inside a project).

Search projects box: displayed on every page for visual consistency. It
is currently a static display element and does not filter results.

Notification bell with an unread count badge. Clicking opens a panel
listing notifications with a "Mark all read" action (see 2.5).

## 2.4 Page conventions

Page header - a title and a one-line subtitle describing the page (for
example the person's name and role).

KPI cards - small summary figures at the top of many pages.

Tabs - horizontal tab bars split a page into sections. Some tabs are
shown only to certain roles.

Panels - white cards with a title, optional subtitle and either a form
or a table.

Status pills - coloured labels for statuses such as Approved, Pending
review, Revise, Awaiting response, Sent, Acknowledged.

Modals - pop-up forms used for adding or editing records (around 20 are
defined, for example employee profile, travel booking, member edit,
transmittal entry).

## 2.5 Notifications

Events in the dashboard raise in-app notifications addressed to specific
roles. Examples: a work-progress update (to the TL, Founding and Working
Directors), a revision raised by a TL, a transmittal created or its
status changed (to the TL). Each notification has a title, a short
detail line and a read/unread state. The bell shows only notifications
addressed to the signed-in role.

## 2.6 Mandatory daily man-hours and sign-out

Every internal employee must record the hours worked each day. The
dashboard enforces this when the user signs out:

The user clicks the sign-out button.

If no hours have been recorded for today, a confirmation asks whether
man-hours have been entered.

Yes signs the user out. No takes the user to the place where hours are
entered and shows a note: "Man-hour entry is mandatory before you sign
out."

When the user submits an update with hours, the sign-out completes
automatically.

Where the user is taken depends on the role:

  -----------------------------------------------------------------------
  Role                                Hours are entered in
  ----------------------------------- -----------------------------------
  Engineer / Drafter                  My work → Update progress tab

  Coordinator (SPOC)                  My coordination → Daily work update
                                      tab

  All other internal roles            The Update Work Progress page (left
                                      navigation)

  Client, Architect                   Not required (external users)
  -----------------------------------------------------------------------

## 2.7 Role access enforcement

Access is controlled in two layers: the navigation list (what a role can
click) and a second check when a page is opened. If a user tries to open
a page their role may not use, the dashboard redirects them to their own
home page. Details are in section 3.3.

# 3. User Roles and Access

## 3.1 Roles in the dashboard

The dashboard defines 26 roles. Each has a named demo user, a
designation and a home (landing) page.

  --------------------------------------------------------------------------------
  Role             User           Designation      Home page        sign-in email
  ---------------- -------------- ---------------- ---------------- --------------
  Founding                        Founding         Projects         
  Director                        Director         (Dashboard)      

  Working Director                Working Director Projects         
                                                   (Dashboard)      

  Admin / Billing                 Administrator,   Projects         
                                  Admin / Billing  (Dashboard)      

  HR                              HR lead          HR               

  Executive                       Executive        Projects         
  Director                        Director         (Dashboard)      

  Associate                       Associate        Projects         
  Director                        Director         (Dashboard)      

  Technical                       Technical        Projects         
  Director                        Director         (Dashboard)      

  Associate                       Associate        My team          
  Technical                       Technical                         
  Director                        Director                          

  Team Lead (TL)                  Team Lead,       My team          
                                  Structural                        

  Coordinator                     Coordinator      My coordination  
  (SPOC)                          (SPOC)                            

  Engineer /                      Junior designer, My work          
  Drafter                         Structural                        

  QS                              QS Lead          Work tracking    

  QA/QC                           QA/QC Lead       Work tracking    

  BIM                             BIM Lead         Work tracking    

  GBS                             GBS Lead         Work tracking    

  Marketing                       Marketing Lead   Marketing        
                                                   Dashboard        

  Design                          Design           Design           
  Management Head                 Management Head  Management       

  Finance                         Finance Head     Finance          
                                                   Dashboard        

  QA/QC                           QA/QC            QA/QC            
  Specifications                  Specifications   Specifications   
  Head                            Head                              

  BIM Head                        BIM Head         BIM              

  GBS Head                        GBS Head         GBS              

  Peer Review Head                Peer Review Head Peer Review      

  QS Head                         QS Head          QS               

  Peer Review                     Peer Reviewer,   Work tracking    
                                  Mechanical                        

  Client                          Client -         Project Portal   

  Architect                       Architect of     Project Portal   
                                  record                            
  --------------------------------------------------------------------------------

Home page for "Work tracking" is shown with the title of the specific
service (QS Work Tracking, QA/QC Work Tracking, and so on).

## 3.2 What each group of roles is for

  -----------------------------------------------------------------------
  Group                   Roles                   Typical use
  ----------------------- ----------------------- -----------------------
  Board & leadership      Founding Director,      Complete or
                          Working Director,       near-complete
                          Executive Director      visibility across
                                                  projects, finance, HR,
                                                  departments and
                                                  management dashboards.
                                                  View-oriented: they
                                                  review and approve
                                                  rather than enter
                                                  project data.

  Directorate             Associate Director,     Oversee delivery across
                          Technical Director,     branches and services.
                          Associate Technical     Technical approval of
                          Director                revisions and drawings.
                                                  Associate Technical
                                                  Director also has a
                                                  Team Lead workspace (My
                                                  team).

  Admin, HR & Finance     Admin / Billing, HR,    Company administration
                          Finance Head            and invoicing; employee
                                                  records and leave;
                                                  finance control, travel
                                                  and reports.

  Project delivery        Team Lead, Engineer /   The people who deliver
                          Drafter, Coordinator    and coordinate each
                          (SPOC)                  project day to day.

  Functions               QS, QA/QC, BIM, GBS,    Specialist service
                          Peer Reviewer           teams with a Work
                                                  tracking page tailored
                                                  to their function.

  Department heads        QA/QC Specifications    Overview and approval
                          Head, BIM Head, GBS     dashboards for their
                          Head, Peer Review Head, function.
                          QS Head, Design         
                          Management Head         

  Marketing               Marketing Lead          Portfolio, collateral
                                                  requests and contacts
                                                  database - no billing,
                                                  staffing or technical
                                                  data.

  External                Client, Architect       Project Portal limited
                                                  to their own project:
                                                  view progress, respond
                                                  to requests,
                                                  acknowledge drawings.
  -----------------------------------------------------------------------

## 3.3 Access rules

Client and Architect can open only the Project Portal. Any other page
request returns them to the portal.

Associate Director, Technical Director and Associate Technical Director
are blocked from the HR page, Finance Dashboard, Finance OCC and Revenue
& Financial Reports.

Admin / Billing is blocked from Finance OCC and from the Management &
Leadership Dashboard.

The department dashboards (Structural, Mechanical, Electrical, PHE,
Fire) are restricted to board/leadership roles: Founding Director,
Working Director, Executive Director, Associate Director and Technical
Director.

The Transmittal page (Admin) is available to the Admin role only; every
other role is redirected if they try to open it.

Some tabs inside a page are shown to specific roles only, for example
the TL-only tabs in My team (see 4.21), the Approvals tab in Leave &
Travel (approvers only), and the peer-review tabs in Work tracking (Peer
Reviewer only).

Within project pages, the QA/QC role sees a reduced set of project tabs,
and the Coordinator is scoped to her two allotted projects.

## 3.4 Level and approval policy (from the Org Structure & Policy page)

The dashboard also contains a reference page describing the reporting
hierarchy and what each designation can view, add, edit or approve. In
summary:

  -----------------------------------------------------------------------
  Designation             Project scope           Typical permissions
  ----------------------- ----------------------- -----------------------
  Founding / Working      Complete organisational Full access to every
  Directors               visibility              area, including Admin /
                                                  Billing and HR;
                                                  company-wide travel
                                                  view and approval

  Admin / Billing         Company administration, Full - view / add /
                          invoicing and           edit / approve for
                          collections             billing and project
                                                  administration; travel
                                                  log view and approve
                                                  company-wide

  HR                      Recruitment, records,   Full - view / add /
                          leave and payroll       edit / approve for HR
                          inputs                  records

  Executive Director      Org-wide (excluding     Full view of employees,
                          Admin / HR detail)      departments, projects
                                                  and organisational
                                                  information; view-only
                                                  on Admin / Billing and
                                                  HR; view and approve
                                                  travel

  Associate Director /    All projects, all       View project details,
  Technical Director /    services                client and architect
  Associate Technical                             details, work orders,
  Director                                        team and status; view
                                                  and approve revision
                                                  logs and drawing
                                                  register; view
                                                  transmittals; approve
                                                  travel. No access to
                                                  Admin / Billing and HR
                                                  functions

  Principal Team Lead and Assigned projects only  View project, client
  the design team (Senior                         and work-order details;
  Team Lead → Trainee                             Team Lead adds/edits
  Engineer)                                       the drawing register,
                                                  others view

  Drafting team (Drafting Assigned projects only  Same access pattern as
  Team Lead → Trainee                             the design team
  Draftsman)                                      

  Coordinator (SPOC)      Assigned projects only  View project details;
                                                  view and respond to
                                                  client/architect items;
                                                  add/edit awaiting
                                                  response, drawing
                                                  register and
                                                  transmittals; add
                                                  travel log

  QS                      Function, assigned      View project details;
                          projects                add/edit BOQ / area
                                                  settlement register;
                                                  add travel log

  QA/QC                   Function, assigned      Add/edit site visit
                          projects                log; add revision log
                                                  items found on site

  BIM                     Function, assigned      Add/edit federated
                          projects                model & clash log; add
                                                  variation log (BIM
                                                  scope)

  GBS                     Function, assigned      Add/edit the green
                          projects                building certification
                                                  workflow

  Peer Review             Cross-project,          Add/edit peer review
                          cross-discipline        log, design review
                                                  checklist and comment
                                                  register; add revision
                                                  comments

  Client · Architect      Own project(s) only     View; acknowledge
                                                  drawings; respond to
                                                  requests directed to
                                                  them
  -----------------------------------------------------------------------

Note: this page documents the intended policy. The actual restrictions
that the dashboard enforces are those in section 3.3 and the per-role
navigation and tabs.

# 4. Modules and Dashboards

Each section below follows the same pattern: purpose, who can open it,
how the page is laid out, and then the fields, tables and actions it
contains. Figures and names shown on the pages are demo data.

## 4.1 Projects (Dashboard)

  -----------------------------------------------------------------------
  Item                                Description
  ----------------------------------- -----------------------------------
  Purpose                             Company-wide view of all projects:
                                      where they are, how far along, and
                                      in what state. Home page for the
                                      board roles and Admin; also
                                      available to HR, TL, Coordinator
                                      and QA/QC (scoped to their own
                                      projects).

  Navigation                          "Dashboard" and "Projects" both
                                      open this page.

  Subtitle                            "230 active engagements across 6
                                      branches" (the count adjusts when
                                      the page is scoped for a role).
  -----------------------------------------------------------------------

Page contents

Departments - high-level overview (leadership view): one card per
department - Design Management, HR, QA/QC Specifications, QS, BIM, GBS,
Peer Review, Finance, Marketing, Structural, Mechanical, Electrical, PHE
and Fire - each with two headline figures (for example deliverables and
open RFIs for Design Management; employees and present today for HR) and
an "Open dashboard →" link to that department's page.

Project status cards: Active projects (230), On track (142), Completed
(38), On hold (15) and Other projects (4). Each shows sample project
names and branch; clicking a card filters or opens the matching list.

Completion progress by branch: one card per branch (Bengaluru HQ,
Hyderabad, Mumbai, Chennai, Pune, Kolkata) with project count, average
completion, and sample projects. Clicking a branch drills into its stage
breakdown.

Projects by stage: a chart of projects per design stage for the chosen
branch ("Click a bar to see the projects in that stage").

Sample projects table: Project (with project code), Branch, Client,
Status, Completion and Current stage. Filters for branch and service
(Structural, Electrical, Mechanical, Plumbing, Fire). Clicking a row
opens the Project Detail page (4.2).

New project button opens the New Project form (4.3).

Role scoping

The Coordinator and QA/QC roles see "My projects" - only their two
allotted projects (Business park - Tower A and Whitefield tech campus
for the Coordinator) - instead of the full company list, and the
branch-completion card is limited to those projects.

## 4.2 Project Detail

  -----------------------------------------------------------------------
  Item                                Description
  ----------------------------------- -----------------------------------
  Purpose                             A single project's record: status,
                                      team, scope, work order, contacts,
                                      plus service-wise workspaces.
                                      Opened by clicking a project row.
                                      Breadcrumb: Dashboard /
                                      `<project name>`{=html}.

  Subtitle                            "Design-stage timeline against
                                      plan".

  Summary figures                     Completion, Open flags, Revisions
                                      logged, Drawings submitted;
                                      work-item counts (Total work items,
                                      Approved, Needs attention, Pending
                                      review); and QA/QC counters (No. of
                                      visits, Additional visits, Drawing
                                      issues found).
  -----------------------------------------------------------------------

Tabs

  -----------------------------------------------------------------------
  Tab                                 What it holds
  ----------------------------------- -----------------------------------
  Overview                            Project status; Project details
                                      (source person, referral, project
                                      type, category, owner, start /
                                      expected / actual completion dates,
                                      address, project location with a
                                      location picker, description); Work
                                      order (number, date, contract
                                      completion, scope of work,
                                      document); Client and contacts
                                      (client name, SPOC, email, phone,
                                      billing contact; architect and PMC
                                      with email and contact); Scope and
                                      services; BIM Work Order (BIM WO
                                      number, scope, date, fee, status);
                                      Stage & service-wise status; Stage
                                      timing (planned vs actual vs
                                      variance); Revision logs; Team
                                      (technical director, principal team
                                      lead, designers, drafters, project
                                      team members). Owner and dates can
                                      be changed through "Change owner"
                                      and "Edit dates".

  Coordination                        Coordination log for schematic and
                                      tender, clash log, and a form to
                                      log a coordination item (channel,
                                      service, topic, deadline, type).

  Pending & follow-up                 Open items with source, since-when
                                      and days waiting.

  RFI's                               Log an RFI / query (type,
                                      description, team, tag team, due
                                      date) and the list of RFIs raised
                                      (ID, project, type, description,
                                      team, due, status).

  Meetings                            New meeting form (topic / agenda,
                                      date, time, participants, stage,
                                      mode, meeting link), meeting
                                      schedule with join links, meeting
                                      log / minutes of meeting (outcome /
                                      summary filled in once concluded)
                                      and action items.

  Deliverables & drawings             Add a drawing submission (drawing
                                      number - "not applicable before
                                      GFC", title, submitted to, method,
                                      submission type, what is included
                                      in the stage, reason, email proof
                                      as screenshot / PDF) and the
                                      drawing register.

  Revision logs                       Log a revision (service, stage,
                                      reason, date) and the revision
                                      history by service.

  Reports                             Project status report, weekly
                                      coordination report, meeting report
                                      and pending-action report.

  Service tabs: Coordinator,          Per-service view of team, scope
  Structural, Electrical, Mechanical, status, drawings submitted, open
  Plumbing, Fire                      coordination items, and recent work
                                      updates. Structural also carries
                                      the BOQ built-up area vs work-order
                                      quoted area with variance, and the
                                      area statement history (initial,
                                      revised R02, final area, revision,
                                      prepared by, approved by).

  QS, QAQC, GBS, BIM, Peer review     Function workspaces. QS and QAQC
                                      contain sub-tabs: for QS -
                                      Overview, Log work update, Work
                                      log, Team lead review; for QAQC -
                                      Overview, Log site visit, Designer
                                      alerts, Weekly report. The "Log
                                      work update" form has "1. Select
                                      work type" and "2. Work update"
                                      steps and a team lead review queue.

  Drawings, Variations                Project-level drawing register and
                                      variation items.
  -----------------------------------------------------------------------

Role behaviour

The QA/QC role sees a reduced tab set (Structural, QS, QAQC, GBS,
Variations and the common tabs); electrical, mechanical, plumbing, fire,
peer review, BIM, drawings and coordination tabs are hidden for it.

Board / leadership roles and the Coordinator see the data-entry forms
for coordination, RFI, meeting, drawing and revision in read-only mode:
they can review but not enter data on those tabs (leadership roles) or
only on their own service area (Coordinator).

## 4.3 New Project

  -----------------------------------------------------------------------
  Item                    Description             Description
  ----------------------- ----------------------- -----------------------
  Purpose                 Create a project. The   Create a project. The
                          page states: "These     page states: "These
                          fields become the basis fields become the basis
                          for every filter        for every filter
                          downstream - branch,    downstream - branch,
                          service, and team       service, and team
                          lead."                  lead."

  Opened from             The "New project"       The "New project"
                          button on the Projects  button on the Projects
                          page. A "Back to        page. A "Back to
                          dashboard" button       dashboard" button
                          returns.                returns.

  Actions                 Save, Save & New,       Save, Save & New,
                          Import Projects         Import Projects
                          (Excel), Import team    (Excel), Import team
                          from Excel, Add         from Excel, Add
                          Location (with Save     Location (with Save
                          Location / Cancel).     Location / Cancel).

  Section                 Section                 Fields

  Information             Information             Project Name*, State*,
                                                  Project Type*, Branch
                                                  Name*, Used For*,
                                                  Project Code*, Entity
                                                  Name*, Project
                                                  Location*, Building /
                                                  Street Address 1 and 2,
                                                  City and State Zip
                                                  Code, Job Number.
                                                  Project location can be
                                                  searched, picked from a
                                                  list or entered as a
                                                  custom address ("Set
                                                  project location").

  Scope of Work & Fee     Scope of Work & Fee     For each service -
                                                  Structural, Mechanical,
                                                  Electrical, Plumbing,
                                                  Fire - a scope of work
                                                  and a fee value;
                                                  "Hospitality taken care
                                                  by client?" tick.

  BIM Work Order          BIM Work Order          BIM scope of work, fee
  (optional)              (optional)              / value (optional),
                                                  scope description.

  Principal team leads    Principal team leads    Principal team lead
                                                  assignment per service;
                                                  team import from Excel.

  Contact Details         Contact Details         Client Contact,
                                                  Architect Contact, PMC
                                                  Contact, Peer Review
                                                  Contact, Contact Person
                                                  for Billing.

  Related User            Related User            Project Director\*,
                                                  Project Director
                                                  Designation, Project
                                                  Head, Project Head
                                                  Designation.
  -----------------------------------------------------------------------

Supporting pop-ups: Entity (name, customer group, type, phone, email,
address), Customer Group, Job Number (project name, DesignTree branch,
job number, applicable date), Contact (salutation, name, designation,
company, phone, email) and the three Excel import dialogs (projects,
team, Saral import for employees).

## 4.4 Billing

  -----------------------------------------------------------------------
  Item                    Description             Description
  ----------------------- ----------------------- -----------------------
  Purpose                 Company-wide claims and Company-wide claims and
                          collections across all  collections across all
                          branches.               branches.

  Who                     Founding Director,      Founding Director,
                          Working Director,       Working Director,
                          Executive Director,     Executive Director,
                          Admin / Billing.        Admin / Billing.
                          (Finance sees the       (Finance sees the
                          billing status in its   billing status in its
                          own pages.)             own pages.)

  Summary figures         Total contract value,   Total contract value,
                          Invoiced to date,       Invoiced to date,
                          Billed, Ready for       Billed, Ready for
                          billing, Pending (stage billing, Pending (stage
                          in progress).           in progress).

  Tab                     Tab                     Contents

  Claims                  Claims                  Recent claims table
                                                  (Project, Branch,
                                                  Milestone, Amount,
                                                  Status) with a status
                                                  filter; "Enter new
                                                  billing details" form
                                                  (Project, Stage,
                                                  Amount, Submission
                                                  date) and Submit
                                                  billing entry; actions
                                                  "Mark billed" and
                                                  "Edit" per claim. Items
                                                  flagged for billing
                                                  review are called out.

  Stage tracker & billing Stage tracker & billing Project status
  readiness               readiness               stage-wise: Project,
                                                  Service, Stage, Planned
                                                  completion, Current
                                                  status, Delay and
                                                  Billing readiness
                                                  (Billed / Ready for
                                                  billing / Pending).

  Delay tracker           Delay tracker           Service-wise delays:
                                                  Project, Service /
                                                  Department, Current
                                                  stage, Planned
                                                  completion, Actual /
                                                  current status, Delay
                                                  (days), Reason.

  Project quoted fee      Project quoted fee      Project, Scope of work,
                                                  Quoted fee and
                                                  Hospitality
                                                  (client-arranged)
                                                  table, with a "Set /
                                                  update quoted fee" form
                                                  (Project, Quoted fee in
                                                  ₹).
  -----------------------------------------------------------------------

## 4.5 Completion Certificates

  -----------------------------------------------------------------------
  Item                                Description
  ----------------------------------- -----------------------------------
  Purpose                             Issued certificates, templates, and
                                      certificate requests made to
                                      clients.

  Who                                 Founding and Working Director,
                                      Admin, HR, Executive, Associate,
                                      Technical and Associate Technical
                                      Director.
  -----------------------------------------------------------------------

Completion Certificates table: Project, Certificate type, Stage, Status,
Issued date, Issued by.

Templates: Category, Template file, Uploaded on. Form to add a template
(Certificate category, Upload template file) with an "Add template"
button and a Download action.

Request completion certificate from client: choose Project and Category,
then "Send request to client". The request appears in the Client Portal
(4.16).

Client-uploaded certificates: Project, Category, Requested, Status,
Uploaded file.

## 4.6 Teams

  -----------------------------------------------------------------------
  Item                                Description
  ----------------------------------- -----------------------------------
  Purpose                             Team rosters and weekly time
                                      approval. Subtitle: "45 teams
                                      across 6 services - 2 example teams
                                      per service, click any to open its
                                      roster".

  Team page                           Opened from a team card; "Back to
                                      teams" returns. Panels: Team roster
                                      (Employee, Role, Hours, Status),
                                      Projects this week (Project, Hours
                                      logged, % of logged time), Weekly
                                      approval (Approve per entry), and
                                      "Log today's work" (Project, Stage,
                                      Hours worked, Type) with a "This
                                      week's entries" table (Date,
                                      Project, Stage, Type, Hours,
                                      Status).
  -----------------------------------------------------------------------

## 4.7 HR

  ------------------------------------------------------------------------
  Item                    Description             Description
  ----------------------- ----------------------- ------------------------
  Purpose                 Employee records and    Employee records and
                          workforce               workforce
                          administration,         administration,
                          company-wide.           company-wide.

  Who                     Founding Director,      Founding Director,
                          Working Director,       Working Director,
                          Executive Director, HR  Executive Director, HR
                          (home page for HR).     (home page for HR).

  Summary figures         Total employees,        Total employees, Present
                          Present today, On leave today, On leave today,
                          today, Travel this      Travel this week.
                          week.                   

  Tab                     Tab                     Contents

  Overview                Overview                Attendance today (On
                                                  leave, Work from home,
                                                  Absent, with an Employee
                                                  / Branch / Service /
                                                  Today's status table)
                                                  and Upcoming travel.

  Employee management     Employee management     Employee directory (ID,
                                                  Name, Branch, Service,
                                                  Designation, Experience,
                                                  Reports to) and an Add
                                                  new employee form
                                                  modelled on a payroll
                                                  master: SL No., EMP ID,
                                                  Rejoinee, Previous Emp
                                                  ID, Salutation, First /
                                                  Middle / Last / Short
                                                  name, Father's and
                                                  Mother's name, Date of
                                                  birth, Sex, Marital
                                                  status, Spouse name,
                                                  Designation,
                                                  Qualification,
                                                  Department, Reporting
                                                  manager, Branch,
                                                  Division, Salary
                                                  structure, Attendance,
                                                  Bank account / name /
                                                  IFSC, residence address
                                                  fields, E-mail, STD
                                                  code, Phone, Mobile,
                                                  Date of joining,
                                                  Salary-calculate-from,
                                                  Date and reason of
                                                  leaving, ESI
                                                  (applicable, number,
                                                  dispensary), PF
                                                  (applicable, number,
                                                  department file number,
                                                  UAN, restrict PF, zero
                                                  pension), Zero PT, PAN,
                                                  Ward / circle, Director,
                                                  Aadhar number, Remarks.
                                                  Buttons: Save employee,
                                                  Cancel, Add employee,
                                                  Import from Saral. An
                                                  employee profile pop-up
                                                  shows documents and can
                                                  import files from the
                                                  system.

  Track record            Track record            Per employee: Joining
                                                  and role (joining date,
                                                  designation, branch /
                                                  service, reporting
                                                  manager); Team and
                                                  project history (current
                                                  team, active project,
                                                  transfers / promotions);
                                                  Performance (performance
                                                  record); Leave and
                                                  travel history (leave
                                                  balance).

  Attendance and leave    Attendance and leave    Today's status table and
                                                  Leave requests
                                                  (Employee, Type, Dates,
                                                  Status) with Approve
                                                  actions.

  Login Hours             Login Hours             Login hours by project
                                                  and stage: Project,
                                                  Stage, Employees logged
                                                  in, Total hours, Avg.
                                                  hours / employee. KPIs:
                                                  total hours logged
                                                  today, projects with
                                                  activity, stages in
                                                  progress, average hours
                                                  per stage.

  Travel log              Travel log              Travel log (Employee,
                                                  Purpose, Location,
                                                  Travel date, Return
                                                  date, Status), travel by
                                                  purpose this quarter,
                                                  top travellers this
                                                  quarter (Employee,
                                                  Branch, Trips, Total
                                                  spend). KPIs: Trips this
                                                  quarter, Upcoming,
                                                  Travel spend (quarter).

  Meeting log             Meeting log             Log a meeting (date,
                                                  employee, type, topic,
                                                  conducted by, notes) and
                                                  the meeting log table.

  Holiday calendar        Holiday calendar        Add a holiday and view
                                                  "Holidays this year";
                                                  entries can be removed.

  Employee support        Employee support        Salary slip requests
                                                  (Employee, Role, Month,
                                                  Requested on, Status,
                                                  Issued on) with "Mark
                                                  issued"; Complaints,
                                                  suggestions & queries
                                                  table (ID, Type,
                                                  Employee, Category,
                                                  Subject, Submitted,
                                                  Status, Assigned to,
                                                  Latest remark) with "Add
                                                  remark" and "View &
                                                  update". These are the
                                                  requests raised from the
                                                  Employee support page
                                                  (4.19).

  Recruitment requests    Recruitment requests    Requests raised by TLs
                                                  (ID, Requesting TL,
                                                  Department, Position,
                                                  Headcount, Submitted,
                                                  Status) with an
                                                  update-status pop-up.

  Reports and analytics   Reports and analytics   Headcount by branch,
                                                  Headcount by service,
                                                  Team-wise capacity
                                                  (Service, Headcount,
                                                  Active projects, Load /
                                                  person, Capacity).
  ------------------------------------------------------------------------

## 4.8 Work Progress

  -----------------------------------------------------------------------
  Item                    Description             Description
  ----------------------- ----------------------- -----------------------
  Purpose                 Organisation-wide       Organisation-wide
                          activity for today      activity for today
                          across Admin, HR,       across Admin, HR,
                          Principal Team Leads    Principal Team Leads
                          and every DesignTree    and every DesignTree
                          employee.               employee.

  Who                     Founding and Working    Founding and Working
                          Director, Executive,    Director, Executive,
                          Associate, Technical    Associate, Technical
                          and Associate Technical and Associate Technical
                          Director, TL.           Director, TL.

  Summary figures         Total hours logged      Total hours logged
                          today, Employees logged today, Employees logged
                          in, Departments         in, Departments
                          covered, Not yet        covered, Not yet
                          updated.                updated.

  Tab                     Tab                     Contents

  Department / Project /  Department / Project /  "Today's activity, by
  Stage-wise              Stage-wise              department" (Employee,
                                                  Role, Department, Work
                                                  logged today, Hours,
                                                  Status) and "Work
                                                  logged today" by
                                                  project and stage.

  Extra Hours (\>8h/day)  Extra Hours (\>8h/day)  Employees who logged
                                                  more than eight hours:
                                                  Employee, Department,
                                                  Project, Date, Hours,
                                                  Reason.

  Sunday Work             Sunday Work             Sunday work record:
                                                  Employee, Department,
                                                  Project, Date, Hours,
                                                  Reason.

  Other Holiday Work      Other Holiday Work      Work on other holidays,
                                                  same columns.
  -----------------------------------------------------------------------

## 4.9 Transmittal Log (company register)

  -----------------------------------------------------------------------
  Item                                Description
  ----------------------------------- -----------------------------------
  Purpose                             The company-wide register of
                                      drawing transmittals. Subtitle:
                                      "Company-wide register · August
                                      2025 · 473 transmittals across 136
                                      projects".

  Who                                 Founding and Working Director,
                                      Executive, Associate, Technical and
                                      Associate Technical Director, TL,
                                      Engineer/Drafter, Coordinator, HR,
                                      QA/QC. Not shown in the Admin
                                      navigation (Admin uses the
                                      Transmittal page, 4.10).

  Scope                               Shows transmittals for the user's
                                      assigned projects only. Founding /
                                      Working Directors, the Executive
                                      Director, Admin / Billing and
                                      Associate / Technical Directors can
                                      see the complete register.

  Summary figures                     Transmittals, Sheets issued,
                                      Projects, Revisions issued (R1+).
  -----------------------------------------------------------------------

Register table: Date, Project, Dept, Print, Document Type, Service,
Team, TR No., Qty, Set, Total, Rev, Reason for revision.

Log transmittal pop-up: Date*, TR No.*, Project*, Department*, Team
member, Type of Print*, Document Type*, Service, Qty (sheets)*, Sets*,
Revision, Reason for revision.

Export CSV downloads the register.

Area Variance tab (for selected roles): Project, Zone / block, Initial
(sqft), Revised (sqft), Variance, Status, Remarks.

  -----------------------------------------------------------------------
  This register is separate from the Admin Transmittal page. The Admin
  page tracks the issue of GFC drawings shared by Team Leads and their
  acknowledgement status; this register is the historical record of
  printed / issued transmittals.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

## 4.10 Transmittal (Admin)

  -----------------------------------------------------------------------
  Item                                Description
  ----------------------------------- -----------------------------------
  Purpose                             Lets the person responsible for
                                      handling transmittals (the Admin
                                      role) create and manage
                                      transmittals based on the drawing
                                      lists that Team Leads have shared,
                                      track their status, and exchange
                                      the log with Excel. Subtitle:
                                      "Admin · create and manage
                                      transmittals from the drawing lists
                                      shared by Team Leads".

  Who                                 Admin only. Other roles are
                                      redirected if they try to open it.

  Key rules                           1\. GFC only - transmittals are
                                      issued only for drawings at GFC
                                      stage. 2. Numbers are generated
                                      automatically (format
                                      TR-2026-0104). 3. Drawing details
                                      always match the TL list (project,
                                      drawing no., revision, title,
                                      service, stage).

  Summary figures                     Transmittal entries; Drawings
                                      awaiting transmittal (GFC drawings
                                      with no transmittal yet); Pending /
                                      prepared; Sent, awaiting
                                      acknowledgement; Acknowledged.
  -----------------------------------------------------------------------

### Tab 1 - Transmittal log

Search (TR number, drawing no., title, ID) and filters by project and
status.

Table columns: ID, TR no., Date, Project, Drawing (with title, service
and stage), Rev, Issued to, Method, Status, Sent, Acknowledged, Handled
by, Remarks and an Edit link.

Status is changed directly in the table from a drop-down: Pending,
Prepared, Sent, Acknowledged, Returned for revision, Cancelled. Setting
Sent or Acknowledged fills the Date sent / Acknowledged on
automatically, writes a history entry and notifies the Team Lead.

Add transmittal pop-up: choose the drawing from a list of GFC drawings
shared by Team Leads (project, drawing number, revision, title, service
and stage are filled from it and cannot drift from the TL list), then
set Transmittal no. (blank = auto), Date, Issued to (Client, Architect,
PMC, Contractor, Authority, Other), Method (Portal, Email, Courier, Hand
delivery, Transmittal), Status, Date sent, Acknowledged on, Handled by
and Remarks. Validation: acknowledgement cannot precede dispatch; the
same drawing, revision and TR number cannot be logged twice.

Edit opens the same pop-up and shows the entry's change history.

Re-sync with TL list refreshes title, service and stage in the log from
the current TL drawing lists and records the change in history.

Export to Excel downloads an editable workbook (see below).

### Tab 2 - TL drawing lists

The basis for the log. Lists every drawing shared by Team Leads:
Project, Drawing no., Title, Rev, Service, Stage, Shared by TL, Date
shared and Transmittal status. Drawings at GFC stage that have not been
transmitted show a tick-box; other drawings are listed for reference and
marked "Not at GFC stage". Select drawings (or select all), optionally
set Date, Issued to, Method and Remarks, and choose Create transmittal
entries. The system generates one TR number per project and recipient,
creates the entries as Pending, and notifies the TL.

### Tab 3 - Import from Excel

Choose an Excel (.xlsx) or CSV file. The first sheet named like
"Transmittal", otherwise the first sheet, is read.

Columns are mapped automatically to the log fields by heading
(alternative headings are recognised, for example "Dwg No" for Drawing
No., "Mode" for Method, "Revision" for Rev). A mapping table lets the
user correct any column.

The file is validated and every row is classified New, Update, Unchanged
or Error, with the reason. Checks include: project must be known;
drawing must exist in the TL list for that project and revision (blank
revision is filled from the list); drawing must be at GFC stage for new
entries; recipient, method and status must be valid; dates must be valid
and acknowledgement not before dispatch; duplicate rows in the file are
rejected.

Drawing title, service and stage in the file are corrected to the TL
list values and a note is shown. Rows without a TR number receive
automatic numbers.

Nothing changes until the user confirms. New rows are added. Updates to
existing entries are applied only if the confirmation box is ticked.
Rows with errors are never imported. Blank cells never erase existing
data. An Undo this import button restores the log as it was.

The exported workbook contains three sheets: "Transmittal Log" (all log
fields, including source and last updated), "TL drawing list" (every TL
drawing with its transmittal status) and "Lists" (valid values and
import notes). Exporting an unmodified file and importing it again
produces no changes.

What the Team Lead sees

A Transmittal status tab in My team (4.21) shows progress per project
(acknowledged, sent / in preparation, awaiting transmittal) and the
latest status of every transmittal for the TL's projects. It is
read-only and refreshes as Admin updates statuses.

## 4.11 Design Management

  -----------------------------------------------------------------------
  Item                    Description             Description
  ----------------------- ----------------------- -----------------------
  Purpose                 The Design Management   The Design Management
                          Coordinator Head (SPOC  Coordinator Head (SPOC
                          Head) workflow:         Head) workflow:
                          coordination,           coordination,
                          deliverables and RFI    deliverables and RFI
                          tracking across         tracking across
                          disciplines.            disciplines.
                          Coordinators work under Coordinators work under
                          Design Management and   Design Management and
                          report through the      report through the
                          Technical Director -    Technical Director -
                          Design Management.      Design Management.

  Who                     Founding and Working    Founding and Working
                          Director, Executive,    Director, Executive,
                          Associate, Technical    Associate, Technical
                          and Associate Technical and Associate Technical
                          Director, and the       Director, and the
                          Design Management Head  Design Management Head
                          (home page).            (home page).

  Summary figures         Deliverables tracked,   Deliverables tracked,
                          On track / submitted,   On track / submitted,
                          RFIs / queries open,    RFIs / queries open,
                          Pending Technical       Pending Technical
                          Director action, Closed Director action, Closed
                          this period, Pending    this period, Pending
                          items & follow-ups,     items & follow-ups,
                          RFIs open / closed,     RFIs open / closed,
                          Meetings online /       Meetings online /
                          offline, Revisions      offline, Revisions
                          within stage / after    within stage / after
                          stage completion.       stage completion.

  Tab                     Tab                     Contents

  Workflow                Workflow                Performance overview,
                                                  "Coordinators' work -
                                                  project / service /
                                                  stage-wise" and the
                                                  16-step coordination
                                                  workflow with a status,
                                                  input / remarks and
                                                  date per step. Steps: 1
                                                  Project received /
                                                  initiated; 2 Review
                                                  scope & requirements; 3
                                                  Identify required
                                                  disciplines & teams; 4
                                                  Allocate SPOC /
                                                  coordination team; 5
                                                  Prepare responsibility
                                                  & communication matrix;
                                                  6 Coordinate with PTL /
                                                  Technical Director /
                                                  design teams; 7 Track
                                                  design inputs &
                                                  deliverables (CD → SD →
                                                  DD → TD → GFC); 8
                                                  Monitor
                                                  interdisciplinary
                                                  coordination; 9 Track
                                                  RFIs / queries / design
                                                  issues / client
                                                  comments; 10 Assign
                                                  action to responsible
                                                  team; 11 Monitor action
                                                  & due dates; 12
                                                  Escalate delays /
                                                  critical issues; 13
                                                  Review status &
                                                  coordination reports;
                                                  14 Ensure closure of
                                                  comments / queries /
                                                  revisions; 15 Final
                                                  coordination &
                                                  submission; 16 Update
                                                  dashboard & close
                                                  activity. Each step
                                                  belongs to a concerned
                                                  head (Director,
                                                  Coordinator, Technical
                                                  Director or TL); only
                                                  that head - or the
                                                  Design Management
                                                  Head - can update it.
                                                  Board roles view only.

  Responsibility &        Responsibility &        Discipline / team, SPOC
  communication matrix    communication matrix    / Coordinator,
                                                  Technical Director,
                                                  communication channel
                                                  and frequency.

  Deliverables tracker    Deliverables tracker    Project, Deliverable,
                                                  Stage, Status, Due
                                                  date, Assigned by.

  RFIs, queries &         RFIs, queries &         ID, Project, Type,
  comments                comments                Description, Team,
                                                  Raised by, Assigned to,
                                                  Due, Status for RFIs,
                                                  queries, design issues
                                                  and client comments.

  Team & Client Updates   Team & Client Updates   SPOC (Coordinator)
                                                  activity - cab bookings
                                                  and coordination
                                                  alerts; PTL updates; QS
                                                  updates; QA/QC updates;
                                                  Client & Architect
                                                  updates; and Projects &
                                                  meetings (Project,
                                                  Branch, Stage,
                                                  Progress, Next
                                                  meeting).
  -----------------------------------------------------------------------

## 4.12 Marketing Dashboard

  -----------------------------------------------------------------------
  Item                                Description
  ----------------------------------- -----------------------------------
  Purpose                             Project details for marketing and
                                      portfolio use - deliberately
                                      without billing, staffing or
                                      technical data.

  Who                                 Founding and Working Director and
                                      the Marketing Lead (home page).

  Summary figures                     Portfolio projects, Completed,
                                      Ongoing, Marketing-ready; and
                                      contact totals - Total contacts,
                                      Clients, Architects, Contractors,
                                      Govt. officials.
  -----------------------------------------------------------------------

Portfolio projects table: Project, Client, Location, Category, Stage,
Completion, Marketing-ready.

Project marketing brief: per project - Client, Location, Category,
Architect, Stage, Completion, Description, Key highlights, Client
testimonial, Awards / recognition, Photos / renders.

Request marketing collateral: Project, Request type, Notes, then Send
request; the request log shows Project, Request type, Notes, Requested,
Status.

Contacts database: add a contact (Contact type*, Full name*,
Organization / Company*, Designation / Role, Phone*, Email, City /
Location, Related project, Trade / Scope of work, Department /
Jurisdiction) and view All contacts (Type, Name, Organization / Dept.,
Designation, Phone, Email, City, Related project, Trade / Jurisdiction,
Notes, Added by, Added on) with Download Excel.

## 4.13 Management & Leadership Dashboard

  -----------------------------------------------------------------------
  Item                    Description             Description
  ----------------------- ----------------------- -----------------------
  Purpose                 Consolidated overview   Consolidated overview
                          of project delivery,    of project delivery,
                          commercial performance, commercial performance,
                          people and              people and
                          department-wise         department-wise
                          activity across the     activity across the
                          company. Subtitle:      company. Subtitle:
                          "Consolidated overview  "Consolidated overview
                          of project delivery,    of project delivery,
                          commercial performance, commercial performance,
                          people and              people and
                          department-wise         department-wise
                          activity across the     activity across the
                          company".               company".

  Who                     Founding Director,      Founding Director,
                          Working Director,       Working Director,
                          Executive Director and  Executive Director and
                          the Associate /         the Associate /
                          Technical / Associate   Technical / Associate
                          Technical Directors     Technical Directors
                          (the Associate          (the Associate
                          Technical Director      Technical Director
                          lands on My team        lands on My team
                          instead). The Associate instead). The Associate
                          Director's Finance tab  Director's Finance tab
                          is blocked.             is blocked.

  Filters                 Branch, Service, Stage, Branch, Service, Stage,
                          Project, From and To    Project, From and To
                          dates, with a Reset     dates, with a Reset
                          filters button. Filters filters button. Filters
                          apply across the tabs.  apply across the tabs.

  Headline figures        Active projects,        Active projects,
                          Projects on hold,       Projects on hold,
                          Completed projects,     Completed projects,
                          Total (filtered),       Total (filtered),
                          Revisions (filtered),   Revisions (filtered),
                          Ready for billing,      Ready for billing,
                          Billing pending,        Billing pending,
                          Invoice raised,         Invoice raised,
                          Received, Requested,    Received, Requested,
                          Total projects, Total   Total projects, Total
                          contract value, Revenue contract value, Revenue
                          till date, Outstanding. till date, Outstanding.

  Tab                     Tab                     Contents

  1\. Projects            1\. Projects            Branch-wise,
                                                  service-wise and
                                                  stage-wise project
                                                  overview (counts,
                                                  active, completed);
                                                  number of revisions;
                                                  project submissions;
                                                  pending / delayed
                                                  submissions; awaiting
                                                  responses; projects
                                                  ready for billing;
                                                  completion
                                                  certificates.

  2\. Admin / Billing     2\. Admin / Billing     Branch-wise,
                                                  service-wise and
                                                  stage-wise financial
                                                  overview (contract
                                                  value, invoiced,
                                                  received); invoice
                                                  status; transmittal
                                                  log.

  3\. Finance             3\. Finance             Revenue by project,
                                                  project-wise cost and
                                                  financial performance
                                                  (contract value,
                                                  invoiced, received, %
                                                  collected,
                                                  outstanding). Blocked
                                                  for the Associate
                                                  Director.

  4\. HR                  4\. HR                  Login hours, leave
                                                  status, leave denied.

  5\. Travel Log          5\. Travel Log          Travel summary, cab /
                                                  transportation details
                                                  and hours spent on each
                                                  project.

  6\. PTL                 6\. PTL                 Project-wise work /
                                                  progress overview,
                                                  project progress /
                                                  status and client-wise
                                                  project overview.

  7\. BIM & GBS           7\. BIM & GBS           BIM and green-building
                                                  progress across
                                                  projects.

  8\. Peer Review         8\. Peer Review         Peer review progress
                                                  and open comments.

  9\. QA/QC               9\. QA/QC               Site visits and
                                                  discrepancies found.
  -----------------------------------------------------------------------

The page is for review only; it contains no data-entry forms.

## 4.14 Finance Dashboard

  -----------------------------------------------------------------------
  Item                                Description
  ----------------------------------- -----------------------------------
  Purpose                             A consolidated snapshot of revenue,
                                      billing, project cost and
                                      performance, travel spend and
                                      approvals across the Finance
                                      module.

  Who                                 Finance Lead (home page), Founding
                                      / Working / Executive Director.
                                      Associate Director and Associate
                                      Technical Director are blocked.

  Headline figures                    Total contract value, Invoiced to
                                      date, Received to date, %
                                      collected, Pending approvals,
                                      Travel spend (all departments),
                                      Hours logged today, Projects at
                                      risk / delayed.
  -----------------------------------------------------------------------

Revenue by project (Project, Contract value, Invoiced, % collected) with
a "Full report →" link to Revenue & Financial Reports.

Billing status counters - Billed, Ready to bill, Pending - with "View
all →" to Billing Status.

Project Cost & Performance snapshot: Project, Status, Quoted fee, Actual
margin, Total delay, with "Open tracker →".

Project Cost Summary: Total Project Cost, Total Labour Cost, Total Other
Expenses, and a table of Project, Total man-hours, Project labour cost,
Other project expenses, Total actual project cost, Project budget,
Budget utilised %, Remaining budget and Cost variance.

Revenue by department / service category (Projects, Contract value,
Invoiced, % collected).

Finance Operation Control Center shortcut and Travel Booking shortcut.

  -----------------------------------------------------------------------
  Tab                                 Contents
  ----------------------------------- -----------------------------------
  Travel Expenses                     Travel expense summary: Employee,
                                      Department, Project, Dates,
                                      Check-in, Check-out, Hotel,
                                      Location, Nights, Hotel cost,
                                      Advance, Actual expense,
                                      Hospitality (client-arranged),
                                      Balance, Settlement.

  Leave Approvals                     Finance team leave requests
                                      (Employee, Type, From, To, Days,
                                      Reason) with Approve / Reject.
                                      Leave requests from other
                                      departments are actioned in Leave &
                                      Travel → Approvals; Finance
                                      approves travel requests from every
                                      department.

  Login Hours                         Login hours by project and stage
                                      (Employees logged in, Total hours,
                                      Avg. hours / employee).
  -----------------------------------------------------------------------

## 4.15 Finance sub-pages

### Revenue & Financial Reports

Service-wise financial view per project; project team, services and
revenue are linked and auto-consolidated into a project-wise report with
a stage-wise billed / received breakup. Four tabs:

By project & service: Job No., Project, Service, Team lead, Stage,
Contract value, Invoiced; filter by project.

Project-wise report: Job No., Project, Services covered, Contract value,
Billed (invoiced), % collected.

Project team (by service): Job No., Project, Service, Team lead,
Experience.

Project Cost & Performance: per project, five sub-views - Overview,
Man-Hours & Cost (department-wise planned vs actual hours, cost, rework
hours, revisions, delay days, then employee, role, task, hours, rate /
hr, cost), Timeline, Delays & Changes, People & Reference. Editing
buttons: Edit project details, Edit change impact, Edit department
budgets (planned hours), add / remove delays, revisions, requests and
employees, and delete an entry.

### Billing Status

Live from Billing's stage tracker: counts of Billed, Ready for billing
and Pending (stage in progress), and a table of Project, Service, Stage,
Planned completion, Current status, Delay and Billing status, filterable
by billing status.

### Travel Booking

Travel and hotel bookings, plus Local Allowance / Cab booking / other
travel requests raised by employees; Finance reviews attached bills and
approves, rejects or returns for clarification.

Counters: Total bookings, Hotel nights (all time), Rescheduled,
Cancelled, Pending, Approved, Rejected, Completed.

Travel Bookings tab: Employee, Department, Project, Dates, Mode,
Check-in, Check-out, Hotel, Location, Nights, Booking status, Reason,
Extra charges; Add travel booking, Edit, Delete, Mark completed, Export
CSV.

Request log (LA / Cab / Other): Employee, Department, Project, Type,
Date, Details, Purpose, Amount, Bill, Status, Remarks, Submitted;
Review.

### Finance Operation Control Center (OCC)

A self-contained sub-application embedded in the page ("DT Finance
Operations Control Centre"). It tracks purchase orders, travel advances
and hospitality / reimbursement claims end-to-end with their own
workflow, bill-verification checklist and audit trail. Buttons: + Travel
advance, + Hospitality / claim, + Purchase order, Save backup, Restore
backup, Reset; filters for date range, employee, project, department,
client, vendor, PO status, travel settlement, reimbursement and payment
status. It stores its own data in the browser and does not interact with
the rest of the dashboard. Available to the Finance Lead and the board
roles; Admin does not see it.

## 4.16 Client Portal

  -----------------------------------------------------------------------
  Item                    Description             Description
  ----------------------- ----------------------- -----------------------
  Purpose                 The external view for a The external view for a
                          client or architect:    client or architect:
                          only their own project, only their own project,
                          without internal data.  without internal data.
                          Subtitle shows the      Subtitle shows the
                          client and project      client and project
                          (Skyline developers Pvt (Skyline developers Pvt
                          Ltd · Business park -   Ltd · Business park -
                          Tower A).               Tower A).

  Who                     Client and Architect    Client and Architect
                          logins (the only        logins (the only
                          navigation item for     navigation item for
                          them).                  them).

  Headline figures        Project completion,     Project completion,
                          Current stage, Pending  Current stage, Pending
                          your response,          your response,
                          Documents to            Documents to
                          acknowledge.            acknowledge.

  Tab                     Tab                     Contents

  Project details         Project details         Project, Code,
                                                  Location, Project type,
                                                  Start date, Expected
                                                  completion,
                                                  Description; Scope and
                                                  services (Service,
                                                  Stage, Status).

  Status by stage         Status by stage         Stage, Planned, Actual,
                                                  Status,
                                                  Acknowledgement.

  Revision log            Revision log            Date, Description,
                                                  Raised by - plus a
                                                  second log for
                                                  client-raised changes.

  Pending requests        Pending requests        Requests needing the
                                                  client's response:
                                                  Raised by, Request,
                                                  Since, Status.

  Drawings & submissions  Drawings & submissions  Drawing submission log
                                                  (Service, Stage,
                                                  Drawing no., Rev,
                                                  Submitted, Method,
                                                  Acknowledgement) and an
                                                  Acknowledge a
                                                  submission form
                                                  (Drawing no., Remarks
                                                  optional) with the
                                                  Confirm received
                                                  button.

  Completion certificates Completion certificates Issued certificates
                                                  (Service, Certificate,
                                                  Issued, Status) and
                                                  Certificate requests
                                                  from Datum (Category,
                                                  Requested, Status) that
                                                  the client uploads
                                                  against.
  -----------------------------------------------------------------------

## 4.17 Leave & Travel

  -----------------------------------------------------------------------
  Item                    Description             Description
  ----------------------- ----------------------- -----------------------
  Purpose                 Employees submit and    Employees submit and
                          track their own leave,  track their own leave,
                          travel, and             travel, and
                          local-allowance / cab / local-allowance / cab /
                          other requests;         other requests;
                          approvers action them.  approvers action them.

  Who                     All internal roles,     All internal roles,
                          including TLs,          including TLs,
                          Engineers / Drafters,   Engineers / Drafters,
                          Coordinators and Admin. Coordinators and Admin.
                          The Approvals tab is    The Approvals tab is
                          shown only to           shown only to
                          approvers.              approvers.

  Headline figures        My leave balance, My    My leave balance, My
                          pending requests,       pending requests,
                          Awaiting my approval,   Awaiting my approval,
                          Travel this quarter.    Travel this quarter.

  Tab                     Tab                     Fields and contents

  Leave request           Leave request           New leave request:
                                                  Employee, Reporting
                                                  manager / PTL, Leave
                                                  type, From date, To
                                                  date, Reason; Submit
                                                  leave request. My leave
                                                  history: Type, From,
                                                  To, Days, Reason,
                                                  Approver, Status.

  Travel request          Travel request          New travel request:
                                                  Project, Purpose, From
                                                  city, To city,
                                                  Departure date, Return
                                                  date, Mode, Estimated
                                                  expense, Advance amount
                                                  requested. Settle
                                                  travel expense: Trip to
                                                  settle, Advance amount
                                                  received (yes / no and
                                                  amount), Travel fare,
                                                  Lodging (hotel name,
                                                  location, check-in,
                                                  check-out, nights),
                                                  Food & per diem, Local
                                                  conveyance,
                                                  Miscellaneous, Actual
                                                  expense (reimbursable),
                                                  Hospitality
                                                  (client-arranged - tick
                                                  "Client arranged" to
                                                  exclude it from
                                                  reimbursement while
                                                  still recording it
                                                  separately), Balance,
                                                  Settlement status and
                                                  date; Save settlement.
                                                  My travel history lists
                                                  project, route, dates,
                                                  mode, advance requested
                                                  / received, actual
                                                  expense, hospitality,
                                                  balance, settlement,
                                                  approval and actions.

  LA / Cab / Other        LA / Cab / Other        Request type, Date,
  requests                requests                Project, Amount, No. of
                                                  days, Route, Pickup and
                                                  Drop location, Meeting
                                                  time, Vehicle type
                                                  (4-wheeler type),
                                                  No. of passengers, Type
                                                  / description, Purpose
                                                  / remarks, Bill /
                                                  invoice attachment;
                                                  Submit request, Cancel
                                                  edit. History table
                                                  with status, remarks
                                                  and submitted date.

  Approvals               Approvals               Leave approvals and
                                                  Travel approvals
                                                  (Employee, Type /
                                                  Project, dates, route,
                                                  estimated expense,
                                                  Status) with Approve /
                                                  Reject, and Recent
                                                  leave decisions
                                                  (Employee, Role, Leave
                                                  type, Decision,
                                                  Remarks, Decided by,
                                                  Date).
  -----------------------------------------------------------------------

Approval routing follows the hierarchy: a Team Lead approves their
team's requests, department heads approve their departments, and Finance
approves travel requests from every department. Decisions are notified
to the requester.

## 4.18 Update Work Progress

  -----------------------------------------------------------------------
  Item                                Description
  ----------------------------------- -----------------------------------
  Purpose                             The common work-update page: hours
                                      worked, work done and the daily
                                      entry linked to a project, stage
                                      and deliverable.

  Who                                 Founding / Working / Executive /
                                      Associate / Technical Directors,
                                      Admin, HR, TL, the department
                                      heads, QS, QA/QC, Peer Review, BIM,
                                      GBS, Marketing, Finance. Not shown
                                      in the navigation for Engineer /
                                      Drafter or Coordinator: those roles
                                      now update progress inside My work
                                      (4.23) and My coordination (4.22)
                                      respectively.

  Sections                            Today's work update (Hours worked,
                                      Date, Work done today); 1. Select
                                      project (Project, Job no., Client,
                                      Branch, Current stage, Project
                                      team); 2. What are you logging work
                                      against? (Assigned Daily Work from
                                      PTL / TL, Hourly work handled,
                                      Drawing, Task / Activity); 3.
                                      Update work progress (Worked on
                                      other projects too? Add their
                                      hours, Remarks).

  Actions                             Submit today's update, Add other
                                      project hours, Submit for team lead
                                      action.

  My submissions                      WU no., Date, Employee, Project,
                                      Stage, Deliverable, Task /
                                      Activity, Drawing, Hourly work
                                      handled, Status.
  -----------------------------------------------------------------------

Submitting an update also records the day's man-hours, which satisfies
the mandatory daily man-hour rule (2.6).

## 4.19 Employee Support

  -----------------------------------------------------------------------
  Item                    Description             Description
  ----------------------- ----------------------- -----------------------
  Purpose                 Request a salary slip   Request a salary slip
                          and raise complaints,   and raise complaints,
                          suggestions or queries  suggestions or queries
                          directly with HR.       directly with HR.

  Who                     All internal roles      All internal roles
                          (including Admin);      (including Admin);
                          handled by HR in HR →   handled by HR in HR →
                          Employee support.       Employee support.

  Tab                     Tab                     Contents

  Salary slip             Salary slip             Request salary slip
                                                  (Month) and My salary
                                                  slip requests (Month,
                                                  Requested on, Status,
                                                  Issued on).

  Complaint box           Complaint box           Raise a complaint
                                                  (Category, Subject,
                                                  Details; Submit
                                                  complaint) and My
                                                  complaints (ID,
                                                  Subject, Category,
                                                  Submitted, Status,
                                                  Latest remark).

  Suggestion box          Suggestion box          Share a suggestion and
                                                  My suggestions, same
                                                  fields.

  Queries                 Queries                 Raise a query and My
                                                  queries, same fields.
  -----------------------------------------------------------------------

## 4.20 Org Structure & Policy

  -----------------------------------------------------------------------
  Item                                Description
  ----------------------------------- -----------------------------------
  Purpose                             Reference page for the reporting
                                      hierarchy, the functions, and what
                                      each designation can view, add,
                                      edit or approve.

  Tabs                                Org structure - cards for Founding
                                      / Working Director, Executive
                                      Director, Associate / Technical /
                                      Associate Technical Director, Admin
                                      / Billing, HR, the Principal Team
                                      Lead → Trainee Engineer ladder, the
                                      Drafting Team Lead → Trainee
                                      Draftsman ladder, Coordinator
                                      (SPOC), QS, QA/QC, BIM, GBS, Peer
                                      Review, and Client / Architect.
                                      Level & approval policy - the
                                      matrix summarised in section 3.4.
  -----------------------------------------------------------------------

## 4.21 My Team (Team Lead / Principal Team Lead)

  -----------------------------------------------------------------------
  Item                    Description             Description
  ----------------------- ----------------------- -----------------------
  Purpose                 Everything a Team Lead  Everything a Team Lead
                          needs to run a team:    needs to run a team:
                          projects, members, work projects, members, work
                          monitoring, assigning   monitoring, assigning
                          work, deliverables,     work, deliverables,
                          revisions, drawings,    revisions, drawings,
                          transmittal progress    transmittal progress
                          and recruitment. Page   and recruitment. Page
                          title "My projects and  title "My projects and
                          team" with the TL's     team" with the TL's
                          name and designation.   name and designation.

  Who                     Team Lead (home page).  Team Lead (home page).
                          Associate Technical     Associate Technical
                          Director sees the same  Director sees the same
                          page with an additional page with an additional
                          Deliverables tab;       Deliverables tab;
                          Technical Director      Technical Director
                          views the team pages in views the team pages in
                          a read-oriented mode.   a read-oriented mode.

  Headline figures        Active projects, Team   Active projects, Team
                          members, Pending        members, Pending
                          review, Awaiting        review, Awaiting
                          response, Open          response, Open
                          revisions; transmittal  revisions; transmittal
                          strip - Transmittal     strip - Transmittal
                          entries, Drawings       entries, Drawings
                          awaiting transmittal,   awaiting transmittal,
                          In preparation, Sent    In preparation, Sent
                          (awaiting               (awaiting
                          acknowledgement),       acknowledgement),
                          Acknowledged.           Acknowledged.

  Tab                     Tab                     Contents

  Overview                Overview                My projects (Project,
                                                  Branch, Status,
                                                  Completion, Flag) and
                                                  Recent team activity
                                                  (WU no., Employee,
                                                  Project, Deliverable,
                                                  %, Status).

  Project & team          Project & team          Per-project team and
                                                  per-member Edit (update
                                                  the member's details
                                                  and allocation).

  Team work monitoring    Team work monitoring    My team (Employee,
                                                  Role, Hours, Status);
                                                  Team efficiency this
                                                  week (Project, Stage,
                                                  Hours logged); Team
                                                  work items (WU no.,
                                                  Employee, Project,
                                                  Stage, Deliverable,
                                                  Status - the percentage
                                                  column was removed);
                                                  Weekly approval with
                                                  Approve and Take
                                                  action.

  Assign work             Assign work             Assign work to a team
                                                  member: Team member(s)
                                                  with Select all / none,
                                                  Project, Stage,
                                                  Deliverable / task, Due
                                                  date, Priority, Notes
                                                  for the designer;
                                                  Assign task. Upload a
                                                  list of drawings
                                                  (Drawing list file;
                                                  Upload list) or key
                                                  them in: Drawing no.\*,
                                                  Title, Service, Stage,
                                                  Rev, Date, Issued to,
                                                  Method, with + Add row.
                                                  Tasks assigned by me
                                                  (Assigned to, Project,
                                                  Stage, Deliverable,
                                                  Due, Priority, Status).

  Deliverables (Associate Deliverables (Associate Add a project
  Technical Director)     Technical Director)     deliverable (Project,
                                                  Deliverable, Specify
                                                  deliverable, Stage) and
                                                  My project
                                                  deliverables.

  Awaiting response       Awaiting response       Employee, Project,
                                                  Item, Waiting on,
                                                  Since, Days waiting,
                                                  Status.

  List of deliverables    List of deliverables    Separate tab: Stage,
                                                  Deliverable, Assigned
                                                  to, Planned date, Due
                                                  date, Status; Save
                                                  list, + Add
                                                  deliverable; and the
                                                  Deliverables log (When,
                                                  Project, Action, Stage,
                                                  Deliverable, Details,
                                                  By). Planned and due
                                                  dates are captured per
                                                  deliverable.

  Revision log            Revision log            Project, Stage, Item,
                                                  Employee, Raised by,
                                                  Raised, Resubmitted,
                                                  Cleared, Status.

  Revision entry          Revision entry          Project*, Stage*,
                                                  Drawing / deliverable*,
                                                  Revision no., Assigned
                                                  to*, Raised by, Date
                                                  raised, Resubmission
                                                  due, Revision
                                                  details\*, and an Email
                                                  notifications option;
                                                  Submit revision &
                                                  notify logs the
                                                  revision and sends
                                                  notification emails
                                                  (listed in "Email
                                                  notifications sent").

  Drawing register        Drawing register        Structural drawing
                                                  register: Drawing no.,
                                                  Title, Service, Stage,
                                                  Rev, Date, Issued to,
                                                  Method, with Add to
                                                  register.

  Transmittal status      Transmittal status      Read-only: Transmittal
                                                  progress by project and
                                                  Latest transmittal
                                                  status for the TL's
                                                  projects, driven by
                                                  Admin's Transmittal
                                                  page (4.10).

  Recruitment requests    Recruitment requests    New recruitment
                                                  request: Department /
                                                  Team, Position /
                                                  Designation, No. of
                                                  employees required,
                                                  Fresher / Experienced,
                                                  Required experience,
                                                  Preferred joining
                                                  timeline, Required
                                                  qualifications,
                                                  Technical skills,
                                                  Required software /
                                                  tools knowledge, Job
                                                  description (JD),
                                                  Project / workload
                                                  requirement, Reason for
                                                  requirement, Additional
                                                  remarks; Submit request
                                                  or Save as draft. My
                                                  recruitment requests
                                                  are listed; HR sees
                                                  them in HR →
                                                  Recruitment requests.
  -----------------------------------------------------------------------

## 4.22 My Coordination (Coordinator / SPOC)

  -----------------------------------------------------------------------
  Item                    Description             Description
  ----------------------- ----------------------- -----------------------
  Purpose                 Single point of contact Single point of contact
                          to client, architect    to client, architect
                          and internal teams.     and internal teams.
                          Allocated to Design     Allocated to Design
                          Management; the         Management; the
                          Coordinator's work,     Coordinator's work,
                          project updates and     project updates and
                          meetings appear on the  meetings appear on the
                          Design Management       Design Management
                          dashboard.              dashboard.

  Who                     Coordinator (home       Coordinator (home
                          page).                  page).

  Headline figures        My projects, Open       My projects, Open
                          alerts, Meetings this   alerts, Meetings this
                          week, Pending my        week, Pending my
                          action.                 action.

  Tab                     Tab                     Contents

  Overview                Overview                My projects (Project,
                                                  Branch, Stage,
                                                  Progress, Status);
                                                  Project overview with
                                                  client, current stage,
                                                  progress, project
                                                  status, project team,
                                                  overall status, recent
                                                  submissions, upcoming
                                                  meetings, key pending
                                                  items, major
                                                  outstanding issues and
                                                  key follow-ups and
                                                  actions; Alerts.

  Other Projects          Other Projects          Limited, view-only
                                                  status for projects
                                                  allotted to other
                                                  SPOCs - enough to stand
                                                  in for a meeting,
                                                  without access to
                                                  detailed project or
                                                  task-level data.

  Project Directory       Project Directory       In-house project team
                                                  across all services
                                                  (Service, Team member,
                                                  Role / responsibility,
                                                  Coordinator / SPOC);
                                                  Team allocation
                                                  (Service, Nominated by
                                                  Director, Team member,
                                                  Approval status) with
                                                  Record allocation;
                                                  Project contacts &
                                                  coordination (Name,
                                                  Organisation, Role,
                                                  Contact, Coordination
                                                  responsibility).

  Daily work update       Daily work update       See below.
  -----------------------------------------------------------------------

### Daily work update / man-hour entry

A simple, activity-based record of what the SPOC did on a given day
under each project and service, and the hours spent. It is not a
task-management module.

  -----------------------------------------------------------------------
  Element                             Description
  ----------------------------------- -----------------------------------
  Date                                Auto-filled with today's date.

  Project name                        Drop-down of the projects assigned
                                      to the SPOC.

  Service                             Structure, Architecture,
                                      Mechanical, Electrical, Plumbing,
                                      Fire, BIM, Other.

  SPOC work performed                 A row per work area, each with a
                                      daily update / remark and
                                      man-hours: Project Directory,
                                      Meetings, Meeting Scheduling &
                                      Coordination, Drawings Sharing /
                                      Issuing, RFI, Architectural
                                      Updates, Client Updates, Revision
                                      Status, Project Status, Other.

  Revision status                     Revision no. and Status (Addressed,
                                      In Progress, Pending, Awaiting
                                      Client, Awaiting Architect,
                                      Awaiting Internal Team) with
                                      Remarks.

  Daily summary                       Total man-hours for the project and
                                      service calculated automatically.
                                      Example: 06-Oct-2026, Project A,
                                      Electrical, total 4.5 hrs.

  Actions                             Save entry and Clear. Several
                                      entries can be saved in a day; My
                                      daily entries lists them.
  -----------------------------------------------------------------------

Saving an entry counts as the day's man-hour entry for the sign-out rule
(2.6). A note on the form states this.

## 4.23 My Work (Engineer / Drafter)

  -----------------------------------------------------------------------
  Item                    Description             Description
  ----------------------- ----------------------- -----------------------
  Purpose                 The personal workspace  The personal workspace
                          of an engineer or       of an engineer or
                          drafter: assigned       drafter: assigned
                          tasks, progress,        tasks, progress,
                          drawings, revisions and drawings, revisions and
                          the daily update.       the daily update.
                          Subtitle: name,         Subtitle: name,
                          designation, and        designation, and
                          "`<TL>`{=html}'s team". "`<TL>`{=html}'s team".

  Who                     Engineer / Drafter      Engineer / Drafter
                          (home page).            (home page).

  Headline figures        Total updates,          Total updates,
                          Approved, Needs         Approved, Needs
                          attention, Pending      attention, Pending
                          review.                 review.

  Layout                  All categories are      All categories are
                          shown as horizontal     shown as horizontal
                          tabs (no drop-down).    tabs (no drop-down).

  Tab                     Tab                     Contents

  Overview                Overview                Assigned to me;
                                                  Awaiting response -
                                                  items with me (Project,
                                                  Item, Waiting on); My
                                                  revisions; Drawing
                                                  register (Project,
                                                  Service, Stage, Drawing
                                                  no., Rev, Date) with
                                                  Upload to register;
                                                  Today's work progress
                                                  (hours logged today,
                                                  tasks touched today);
                                                  Recent updates (WU no.,
                                                  Project, Deliverable,
                                                  %, Status, Date).

  My Projects             My Projects             One card per assigned
                                                  project (Business
                                                  park - Tower A,
                                                  Cambridge court
                                                  residences): Job no.,
                                                  Client, Branch, Current
                                                  stage, Project team, My
                                                  role.

  Work Progress           Work Progress           Work logged today;
                                                  Stage-wise progress
                                                  (hours this week);
                                                  Project-wise progress;
                                                  Sunday work and Other
                                                  holiday work (Date,
                                                  Project, Hours,
                                                  Reason); Extra hours
                                                  beyond 8h.

  Deliverables & Drawings Deliverables & Drawings Pending / overdue tasks
                                                  (Project, Stage,
                                                  Deliverable, Due,
                                                  Priority, Status);
                                                  Drawing submission
                                                  status; GFC drawing
                                                  status; Revision
                                                  details; Pending /
                                                  awaiting responses;
                                                  Transmittal details (TR
                                                  no., Project, Date,
                                                  Ack. status); Log item
                                                  and Log revision.

  Update progress         Update progress         The daily update form
                                                  (see below).

  My submissions          My submissions          WU no., Date, Project,
                                                  Stage, Deliverable,
                                                  Task / Activity,
                                                  Drawing, Hourly work
                                                  handled, Progress %,
                                                  Status, Follow-up.
  -----------------------------------------------------------------------

Update progress form

Select project: the Projects under my PTL drop-down lists every project
assigned under the employee's Principal Team Lead. When an employee is
moved to a higher-priority project, they pick it here; the selected
project is stored on the work-progress entry and shown in My submissions
and in the TL's monitoring pages. Selecting a project fills Job no.,
Client, Branch, Current stage and Project team.

What are you logging work against? - Assigned Daily Work from PTL / TL,
Hourly work handled, Drawing, Task / Activity.

Update work progress - Hours, status / percentage, Remarks, and "Worked
on other projects too? Add their hours" (Add other project hours).

Submit for team lead action sends the update for TL review and records
the man-hours for the day.

"Update Work Progress" is no longer a separate navigation item for this
role; the same functionality is delivered in this tab. A note on the
form explains the mandatory daily man-hour rule.

The Leave and travel panel provides a Go to Leave & Travel shortcut.

## 4.24 Function Workspaces: QS, QA/QC, BIM, GBS and Peer Review

Five roles share one page, "`<Function>`{=html} Work Tracking" (for
example QS Work Tracking, with the lead's name and designation). The
visible tabs and KPIs are tuned per role.

  -----------------------------------------------------------------------
  Role                                Tabs shown
  ----------------------------------- -----------------------------------
  QS                                  Work tracking, Revision log, Area
                                      settlement

  QA/QC                               Work tracking, Site visits, RFI's

  BIM                                 Work tracking, Revision log, BIM
                                      Work Order

  GBS                                 Work tracking, Revision log,
                                      Certification workflow

  Peer Reviewer                       Work tracking, Revision log,
                                      Dashboard, New review, Design
                                      checklist, Comments, Final
                                      approval, SOP reference
  -----------------------------------------------------------------------

### Work tracking and Revision log (all five)

Log work: Project, Work type, Notes, Hours, Date; Log work item. Work
log table: Ref no., Date, Project, Work type, Notes, Hours, Status.

Log a new revision: Project, Stage, Item / description, Raised by,
Service; Log revision. Revision log: Project, Stage, Item, Raised by,
Logged by, Date, Status.

Weekly figures: Work items logged (week), Open revisions, Hours logged
(week), Pending settlements.

### QS - Area settlement

Add area settlement: Project, Zone / block, Initial area (sqft), Revised
area (sqft), Remarks; the register shows Project, Zone / block, Initial,
Revised, Variance, Status, Remarks. Entries are reviewed by the QS Head
(4.25).

### QA/QC - Site visits and RFI's

Site visit overview, Project documents (Document, Uploaded by, Date,
Status) and Recent site visits (Visit no., Project, Phase, Type, Date,
Drawing issue?).

Log a site visit: Project, Visit type (including a colleague's project,
and Construction Pre/post-concreting inspection, site audits), Date,
photos upload, Remarks for client, Remarks for designer, "Additional
visit (not in the planned count)" and "Drawing discrepancy found" with
Severity. Submit visit.

Discrepancy Log: ID, Project, Discipline, Severity, Issue, Raised, Due,
Status.

Weekly report and PTL approval: Week, Project, Visits, Status,
Submitted, Approved.

Log conveyance: Date, Project, Employee, Purpose, Area, Type of vehicle,
Kilometers, Amount, Supporting document; Conveyance Log shows approval
and payment / settlement.

Log an RFI / query: Project, Type, Description, Tag team (optional), Due
date; Log RFI. "RFIs I've raised": ID, Project, Type, Description, Team,
Due, Status.

### GBS - Certification workflow

Green Building Certification Workflow per project: step number, Phase,
Status, Input / remarks, Date.

### BIM - BIM Work Order

BIM Work Order register: BIM WO No., Project, Scope of work, Date, Fee /
value, Status.

### Peer Reviewer tabs

  -----------------------------------------------------------------------
  Tab                                 Contents
  ----------------------------------- -----------------------------------
  Dashboard                           KPIs: Total Reviews, Reviews
                                      Pending, Reviews In Progress,
                                      Overdue Reviews, Comments Raised /
                                      Pending / Re-opened / Closed, Final
                                      Approval Pending, Approved for
                                      Issue. Project-Level View: Project,
                                      Stage, Submission, Reviewer,
                                      Checklist, Comments, Rev.,
                                      Re-check, Approval, Issue.

  New review                          1\. Peer Review Request / Project
                                      Selection (Job No., Client, Project
                                      stage, Discipline, Submission /
                                      revision) and 2. Peer Reviewer
                                      Allocation (Reviewer, Responsible
                                      engineer, Review due date);
                                      Allocate review.

  Design checklist                    Design Review Checklist: Section,
                                      Item, Requirement, Status,
                                      Reviewer, Remarks, Date.

  Comments                            Log a review comment (Document
                                      reference, Observation, Action
                                      required); Review Comment Register:
                                      Comment No., Document Ref.,
                                      Observation, Reviewer, Resp.
                                      Engineer, Action Required,
                                      Response, Rev., Date, Closure
                                      Status, Verified By, Closure Date;
                                      Log comment.

  Final approval                      14\. Final Verification, 15. Final
                                      Approval, 16. Document Issue &
                                      Record.

  SOP reference                       Design Review & Verification
                                      Procedure: Responsibilities, Review
                                      stages, Structural design review
                                      checklist, Review comment register,
                                      Approval before issue.
  -----------------------------------------------------------------------

## 4.25 Function Head Dashboards

Each function head (QA/QC Head, BIM Head, GBS Head, Peer Review Head, QS
Head) lands on a read-oriented overview of their team's work. The Design
Management Head lands on Design Management (4.11); the Marketing Lead on
Marketing (4.12); the Finance Lead on Finance (4.14).

  -----------------------------------------------------------------------
  Page                    Headline figures        Panels
  ----------------------- ----------------------- -----------------------
  QA/QC Specifications    Total site visits,      Project-wise QA/QC
                          Pending report          summary; Weekly reports
                          approval, Drawing       (Week, Project, Visits,
                          issues flagged,         Status, Submitted,
                          Additional visits, Site Approved) with
                          visits, Discrepancies   approval; Recent site
                          during construction,    visits; Discrepancy
                          Drawing discrepancies - Log. Site visits and
                          Structural              weekly reports
                                                  submitted by the QA/QC
                                                  team are approved here.

  BIM                     Active BIM work orders, BIM work orders (BIM WO
                          Team submissions (log), No., Project, Scope,
                          Projects covered        Date, Fee / value,
                                                  Status); Team work log
                                                  (Date, Project, Work
                                                  type, Notes, Hours,
                                                  Status).

  GBS                     Projects in progress,   Certification workflow
                          Phases completed, Team  by project (Project,
                          submissions (log)       Phase, Status,
                                                  Remarks); Team work
                                                  log.

  Peer Review             Reviews in progress,    Peer reviews (ID,
                          Pending approval, Open  Project, Stage,
                          comments                Discipline, Reviewer,
                                                  Due, Status).

  QS                      Team submissions (log), Area settlements
                          Area settlements        (Project, Zone,
                          needing review, Pending Initial, Revised,
                          leave approvals         Remarks, Status) with
                                                  review; Team work log;
                                                  QS leave approvals
                                                  (Employee, Type, From,
                                                  To, Reason, Status)
                                                  with approve / reject.
  -----------------------------------------------------------------------

## 4.26 Department Dashboards: Structural, Mechanical, Electrical, PHE, Fire

Company-wide dashboards for each discipline, reached from the department
cards on the Projects page (for the roles that can open them). All five
share one layout.

Headline figures: Active stages, On-time stages, Pending GFC drawings
(with a call-out naming them, for example the two pending Structural GFC
drawings STR-BPA-GFC-01 and STR-CCR-GFC-01, or Electrical
ELE-BPA-GFC-08) and Awaiting response.

  -----------------------------------------------------------------------
  Tab                                 Columns
  ----------------------------------- -----------------------------------
  Stage-wise Completion & Timing      Project, Stage, Planned start,
                                      Planned submission, Actual
                                      submission, Completion status,
                                      Delay / on-time, Service-wise
                                      performance

  Drawing Submission Log              Dwg / doc no., Drawing title,
                                      Stage, Planned submission, Actual
                                      submission, Submission status,
                                      Delay / on-time, Responsible person

  GFC Drawing Register                Drawing number, Drawing title,
                                      Revision, GFC submission date, GFC
                                      approval / status

  Revision Log                        Dwg / doc no., Revision no.,
                                      Revision date, Reason for revision,
                                      Initiated by, Status, Time taken

  Awaiting Response                   Dwg / doc reference, Submitted
                                      date, Response due date, Days
                                      awaiting, Current status,
                                      Responsible party, Follow-up status

  Transmittal Log                     TR no., Date, Dwg / doc reference,
                                      Stage, Submitted by, Recipient,
                                      Ack. status, Pending response,
                                      Closure date
  -----------------------------------------------------------------------

A further internal view, "DesignTree Pulse" (project cost and
performance - department-wise planned vs actual hours, cost, rework
hours, revisions and delay days with employee-level hour and cost
lines), supplies the data shown on Finance's Project Cost & Performance
tab; it has no navigation entry of its own.

# 5. Key Workflows

End-to-end flows that span more than one role. Each shows who does what
and where the result appears.

## 5.1 Project creation to team set-up

A director (or a role with access) opens Projects → New project and
fills Information, Scope of Work & Fee, Principal team leads, Contact
Details and Related User; projects can also be bulk-loaded by Excel
import.

The project appears in the Projects list and in Project Detail; quoted
fees appear in Billing → Project quoted fee.

The Principal Team Lead sees it under My team → Overview, assigns
members through Project & team, and allocates work through Assign work.

The Coordinator records the SPOC allocation in Project Directory →
Record allocation.

## 5.2 Assigning work and updating progress

The TL opens My team → Assign work, selects one or several team members,
project, stage, deliverable, due date, priority and notes, and assigns
the task (optionally uploading a drawing list or keying drawing
details).

The task shows under My work → Overview → Assigned to me for the
engineer / drafter and in the TL's "Tasks assigned by me" and List of
deliverables (with planned and due dates).

The engineer opens My work → Update progress, picks the project (from
Projects under my PTL, which also covers a project they were reassigned
to), selects the task, drawing and hours, and presses Submit for team
lead action.

The entry gets a WU number, appears in My submissions, in the TL's Team
work monitoring and Weekly approval, and the hours are counted as the
day's man-hours.

The TL approves or takes action; the status flows back to the engineer's
counters (Approved / Needs attention / Pending review).

## 5.3 Revision handling

The TL records the revision in My team → Revision entry (project, stage,
drawing, assignee, raised-by, resubmission due, details) and chooses to
notify.

Submit revision & notify writes the revision to the Revision log,
notifies the assignee and lists the sent emails under "Email
notifications sent".

The item shows under the engineer's My revisions and in the project's
Revision logs; once resubmitted and cleared, the log shows the
Resubmitted and Cleared dates.

## 5.4 Drawing issue and transmittal (GFC)

The TL shares the drawing list (My team → Assign work / Drawing
register). Drawings carry project, drawing number, revision, title,
service and stage.

Admin opens Transmittal → TL drawing lists. Only drawings at GFC stage
can be selected; others are shown as "Not at GFC stage".

Admin chooses Create transmittal entries (or adds one manually, or
imports from Excel). The system generates the TR number (TR-YYYY-NNNN),
copies the drawing details from the TL list, and sets the status to
Pending.

Admin moves the entry through Prepared → Sent → Acknowledged using the
status drop-down (or Returned for revision / Cancelled). Sent and
Acknowledged dates are filled automatically, history is recorded and the
TL is notified.

The TL watches My team → Transmittal status (read-only) and the
transmittal strip on the Overview. The company register and department
dashboards carry the historical transmittal logs.

## 5.5 Daily man-hours and sign-out

Every working day each employee must record man-hours - by submitting a
work update (Engineer / Drafter, TL, department roles) or a Daily work
update entry (Coordinator).

When the user signs out without having recorded today's hours, the
dashboard asks whether they have updated; choosing "No" takes them to
the place where the entry is made (My work → Update progress, My
coordination → Daily work update, or Update Work Progress) and shows the
mandatory note.

Once hours exist, sign-out completes normally.

## 5.6 Leave, travel and approvals

An employee raises a leave, travel or LA / Cab / Other request in Leave
& Travel.

The approver (TL / head / Finance, depending on the request) sees it
under Approvals (and, for Finance, on the Finance Dashboard) and
approves or rejects it.

After a trip the employee uses Settle travel expense to record actual
costs; Finance sees them in Travel Expenses and Travel Booking, and the
OCC tracks advances and claims.

HR sees leave and travel across the company in HR → Attendance and leave
and Travel log.

## 5.7 Employee support

An employee requests a salary slip or raises a complaint, suggestion or
query in Employee support.

HR sees it in HR → Employee support, marks salary slips as issued, adds
remarks and updates complaint status.

The employee sees the status and latest remark in "My ... requests".

## 5.8 Billing and completion certificates

Admin / Billing tracks the stage tracker; stages become "Ready for
billing" when complete. Claims are entered in Billing → Claims and
marked billed.

Finance sees the same data live in Billing Status and Revenue &
Financial Reports.

For closure, Admin sends a certificate request to the client from
Completion Certificates; the client uploads it in the Client Portal and
it appears under "Client-uploaded certificates".

## 5.9 Recruitment

The TL submits a recruitment request (or saves a draft) in My team →
Recruitment requests.

HR reviews it in HR → Recruitment requests and updates its status; the
TL sees the status in "My recruitment requests".

## 5.10 QA/QC site visits

QA/QC logs a site visit (including additional visits and drawing
discrepancies) and a weekly report.

The report goes to the PTL and the QA/QC Head for approval.

Discrepancies appear in the Discrepancy Log, in the project's QAQC tab
and in the Management dashboard's QA/QC tab.

# 6. Recent Changes Included in This Version

The following enhancements are included in the version documented here.
Each was added without altering existing features.

  -----------------------------------------------------------------------
  Area                                Change
  ----------------------------------- -----------------------------------
  Team Lead - My team                 Edit option per team member.
                                      Revision entry tab with email
                                      notifications. Assign work extended
                                      with drawing-details entry and a
                                      list of deliverables / log.
                                      Separate List of deliverables tab
                                      with planned and due dates.
                                      Percentage column removed from Team
                                      work items.

  Admin - Transmittal                 New Transmittal category: log with
                                      status tracking, TL drawing lists
                                      as basis, Excel export / import
                                      with auto-mapping and validation,
                                      undo import. Automatic TR numbers,
                                      details matched to the TL list,
                                      issue only at GFC stage. Read-only
                                      Transmittal status tab for TLs.

  Admin navigation                    The older "Transmittal Log" item is
                                      no longer shown to Admin (the new
                                      Transmittal page replaces it);
                                      other roles keep it.

  Engineer / Drafter - My work        "Update Work Progress" removed from
                                      the navigation (functionality moved
                                      to the Update progress tab).
                                      Categories shown as horizontal
                                      tabs. New Projects under my PTL
                                      drop-down linked to the
                                      work-progress entry.

  Coordinator (SPOC)                  New Daily work update / man-hour
                                      entry tab (project, service, work
                                      areas, revision status, auto total,
                                      multiple entries). "Update Work
                                      Progress" removed from the
                                      navigation; sign-out redirects to
                                      the daily work update.

  Sign-out                            Mandatory man-hour check with
                                      redirect to the role's update
                                      screen.
  -----------------------------------------------------------------------

# 7. Technical Notes and Limitations

Single file: the dashboard is one self-contained HTML file; data is held
in the browser for the session. Demo data is built in.

Browser storage: most data is in memory and resets on reload; the
Finance OCC keeps its own browser storage and offers Save / Restore
backup.

Access control is applied in the interface (navigation, tabs, view
guards). It is suitable for a prototype and demonstration; a production
deployment would need server-side authentication and authorisation.

Authentication: the shared demo password and quick-access buttons are
for demonstration; "Forgot password?" is not wired.

Excel features use the SheetJS library loaded from a CDN, with CSV as a
fallback when it cannot load; charts use Chart.js from a CDN.

Emails: revision and transmittal "notifications" are in-app
notifications and logged email records, not real emails.

Records shown on pages (project names, amounts, counts) are sample data.

# Appendix A. Navigation by Role

The left navigation items each role sees, in order.

  -----------------------------------------------------------------------
  Role                                Navigation items
  ----------------------------------- -----------------------------------
  Founding Director                   Dashboard, Projects, Billing,
                                      Completion Certificates, Teams, HR,
                                      Work Progress, Transmittal Log,
                                      Design Management, Marketing
                                      Dashboard, Finance Dashboard,
                                      Finance Operation Control Center
                                      (OCC), Travel Booking, Revenue &
                                      Financial Reports, Billing Status,
                                      QA/QC Specifications, BIM, GBS,
                                      Peer Review, QS, Structural,
                                      Mechanical, Electrical, PHE, Fire,
                                      Update Work Progress, Leave &
                                      Travel, Employee support,
                                      Management & Leadership Dashboard

  Working Director                    Dashboard, Projects, Billing,
                                      Completion Certificates, Teams, HR,
                                      Work Progress, Transmittal Log,
                                      Design Management, Marketing
                                      Dashboard, Finance Dashboard,
                                      Finance Operation Control Center
                                      (OCC), Travel Booking, Revenue &
                                      Financial Reports, Billing Status,
                                      QA/QC Specifications, BIM, GBS,
                                      Peer Review, QS, Structural,
                                      Mechanical, Electrical, PHE, Fire,
                                      Update Work Progress, Leave &
                                      Travel, Employee support,
                                      Management & Leadership Dashboard

  Admin / Billing                     Dashboard, Projects, Billing,
                                      Completion Certificates, Teams,
                                      Transmittal, Update Work Progress,
                                      Leave & Travel, Employee support,
                                      Settings

  HR                                  Dashboard, Projects, Completion
                                      Certificates, Teams, HR,
                                      Transmittal Log, Update Work
                                      Progress, Leave & Travel, Employee
                                      support

  Executive Director                  Dashboard, Projects, Billing,
                                      Completion Certificates, Teams, HR,
                                      Work Progress, Transmittal Log,
                                      Design Management, Finance
                                      Dashboard, Finance Operation
                                      Control Center (OCC), Travel
                                      Booking, Revenue & Financial
                                      Reports, Billing Status, QA/QC
                                      Specifications, BIM, GBS, Peer
                                      Review, QS, Structural, Mechanical,
                                      Electrical, PHE, Fire, Update Work
                                      Progress, Leave & Travel, Employee
                                      support, Management & Leadership
                                      Dashboard

  Associate Director                  Dashboard, Projects, Completion
                                      Certificates, Teams, Work Progress,
                                      Transmittal Log, Design Management,
                                      Travel Booking, Billing Status,
                                      QA/QC Specifications, BIM, GBS,
                                      Peer Review, QS, Structural,
                                      Mechanical, Electrical, PHE, Fire,
                                      Update Work Progress, Leave &
                                      Travel, Employee support,
                                      Management & Leadership Dashboard

  Technical Director                  Dashboard, Projects, Completion
                                      Certificates, Teams, Work Progress,
                                      Transmittal Log, Design Management,
                                      Travel Booking, Billing Status,
                                      QA/QC Specifications, BIM, GBS,
                                      Peer Review, QS, Structural,
                                      Mechanical, Electrical, PHE, Fire,
                                      Update Work Progress, Leave &
                                      Travel, Employee support,
                                      Management & Leadership Dashboard

  Associate Technical Director        Dashboard, Projects, Completion
                                      Certificates, Teams, Work Progress,
                                      Transmittal Log, Design Management,
                                      Travel Booking, Billing Status,
                                      QA/QC Specifications, BIM Head, GBS
                                      Head, Peer Review Head, QS Head,
                                      Update Work Progress, Leave &
                                      Travel, Employee support, My team

  Team Lead (TL)                      Dashboard, Projects, Work Progress,
                                      Transmittal Log, Update Work
                                      Progress, Leave & Travel, Employee
                                      support, My team

  Coordinator (SPOC)                  Dashboard, Projects, Transmittal
                                      Log, Leave & Travel, Employee
                                      support, My coordination

  Engineer / Drafter                  Transmittal Log, Leave & Travel,
                                      Employee support, My work

  QS                                  Update Work Progress, Leave &
                                      Travel, Employee support, Work
                                      tracking

  QA/QC                               Dashboard, Projects, Transmittal
                                      Log, Update Work Progress, Leave &
                                      Travel, Employee support, Work
                                      tracking

  BIM                                 Update Work Progress, Leave &
                                      Travel, Employee support, Work
                                      tracking

  GBS                                 Update Work Progress, Leave &
                                      Travel, Employee support, Work
                                      tracking

  Marketing Lead                      Marketing Dashboard, Update Work
                                      Progress, Leave & Travel, Employee
                                      support

  Design Management Head              Design Management, Update Work
                                      Progress, Leave & Travel, Employee
                                      support

  Finance Lead                        Finance Dashboard, Finance
                                      Operation Control Center (OCC),
                                      Travel Booking, Revenue & Financial
                                      Reports, Billing Status, Update
                                      Work Progress, Leave & Travel

  QA/QC Head                          QA/QC Specifications, Update Work
                                      Progress, Leave & Travel, Employee
                                      support

  BIM Head                            BIM Head, Update Work Progress,
                                      Leave & Travel, Employee support

  GBS Head                            GBS Head, Update Work Progress,
                                      Leave & Travel, Employee support

  Peer Review Head                    Peer Review Head, Update Work
                                      Progress, Leave & Travel, Employee
                                      support

  QS Head                             QS Head, Update Work Progress,
                                      Leave & Travel, Employee support

  Peer Reviewer                       Update Work Progress, Leave &
                                      Travel, Employee support, Work
                                      tracking

  Client                              Project Portal

  Architect                           Project Portal
  -----------------------------------------------------------------------

# Appendix B. Demo Sign-in Quick Reference

Use the work email in Section 3.1 with the shared demo password shown on
the sign-in screen, or use the Quick demo access buttons.

# Appendix C. Glossary

  -----------------------------------------------------------------------
  Term                                Meaning
  ----------------------------------- -----------------------------------
  TL / PTL                            Team Lead / Principal Team Lead -
                                      leads a discipline team on
                                      projects.

  SPOC                                Single point of contact - the
                                      Coordinator between client,
                                      architect and internal teams.

  GFC                                 Good For Construction - the final
                                      drawing stage; the only stage at
                                      which transmittals are issued.

  CD / SD / DD / TD                   Concept, Schematic, Design
                                      Development and Tender design
                                      stages.

  TR no.                              Transmittal number, TR-YYYY-NNNN.

  WU no.                              Work update number given to each
                                      work-progress entry.

  RFI                                 Request for information / query.

  BOQ / QS                            Bill of quantities / quantity
                                      surveying.

  QA/QC                               Quality assurance and control (site
                                      visits and discrepancy tracking).

  BIM / GBS                           Building information modelling /
                                      green building services
                                      (certification).

  PHE                                 Public health engineering
                                      (plumbing).

  OCC                                 Operations Control Centre - the
                                      Finance sub-application for POs,
                                      advances and claims.

  LA / Cab                            Local allowance and cab booking
                                      requests.

  PMC                                 Project management consultant.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# SPOC Meetings Module --- Functional Documentation

DESIGNTREE SERVICE CONSULTANTS

SPOC Meetings Module

Functional documentation: features, screens, business rules and
workflows

  -----------------------------------------------------------------------
  Item                                Detail
  ----------------------------------- -----------------------------------
  Module                              SPOC Dashboard → Meetings

  Document type                       Functional specification and user
                                      guide

  Version documented                  Prototype version 3 (latest),
                                      including the availability-response
                                      and employee-integration changes

  Document date                       7 October 2026

  Prepared for                        DesignTree / Arictech project
                                      delivery teams, SPOCs, MEP
                                      Coordinators, Structural Design
                                      Leads and the development team
  -----------------------------------------------------------------------

# Contents

Right-click the table above and choose Update Field if page numbers are
not shown.

# 1. Introduction

## 1.1 Purpose of this document

This document describes the SPOC Meetings module in full: what each
screen shows, what every field and control does, the rules the system
applies automatically, and the end-to-end workflows for scheduled and
sudden (ad-hoc) meetings. It is written so that a reader can understand
the complete behaviour of the module without opening the dashboard.

## 1.2 Objective of the module

The SPOC Meetings module is a single meeting-management system for all
project meetings: Client / DRM, DesignTree / Arictech, PMC,
service-specific meetings, scheduled meetings and sudden / ad-hoc
meetings. For every meeting it keeps a complete record of participants,
availability responses, attendance, minutes of meeting (MOM), decisions,
action items, responsibilities, deadlines and follow-ups.

## 1.3 Users and roles

  -----------------------------------------------------------------------
  Role                                What they do in the module
  ----------------------------------- -----------------------------------
  SPOC (Single Point of Contact)      Owns meetings on SMEPF projects and
                                      on projects with multiple services.
                                      Schedules meetings, selects
                                      participants, tracks responses,
                                      marks attendance, records the MOM,
                                      assigns and tracks action items.

  MEP Coordinator                     Takes the SPOC role on projects
                                      where only MEP Coordination
                                      services are committed.

  Structural Design Lead / Design     Takes the SPOC role on projects
  Team                                where only Structural services are
                                      committed.

  Project team members (employees)    Receive meeting invitations,
                                      respond Available / Not Available,
                                      view the MOM, and update the status
                                      of action items assigned to them.
                                      They use the separate Employee
                                      Meeting Dashboard (section 17).
  -----------------------------------------------------------------------

## 1.4 Scope

Covered: meeting categories and types, service-based responsibility,
scheduling and ad-hoc entry, team-member selection, invitations and
availability responses, attendance, MOM, action items, the consolidated
dashboard, alerts, filters, the absence log, project meeting history,
and the link to the Employee Meeting Dashboard.

Prototype note. The module has been built as a working interactive
prototype using sample projects, team members and meetings. Data entered
is saved in the browser of the computer it was entered on. Section 19
lists what is needed to move it into production with shared data.

## 1.5 Version history

  -----------------------------------------------------------------------
  Version                 Date                    Changes
  ----------------------- ----------------------- -----------------------
  1                       1 Oct 2026              Initial Meetings
                                                  module: scheduled and
                                                  sudden meetings,
                                                  service-based
                                                  responsibility, team
                                                  selection from Project
                                                  Team, attendance, MOM,
                                                  action items, dashboard
                                                  summary, filters,
                                                  project history,
                                                  alerts.

  2                       1 Oct 2026              Added the Absence Log
                                                  tab (absent members
                                                  with project, service,
                                                  reason and meeting
                                                  details; summaries by
                                                  member and service;
                                                  copy to Excel) and the
                                                  Absences Recorded
                                                  summary count.

  3 (current)             1 Oct 2026              Added meeting title,
                                                  end time and reference
                                                  documents to the
                                                  meeting form;
                                                  invitations to selected
                                                  team members;
                                                  Availability Responses
                                                  section with reasons;
                                                  response alerts;
                                                  Responses column in the
                                                  meeting list; employee
                                                  progress notes on
                                                  action items; SPOC /
                                                  Employee portal switch.

  3.1                     7 Oct 2026              Fix: dashboard bar
                                                  charts (By meeting
                                                  type, By service,
                                                  Absences by service)
                                                  now display their
                                                  filled bars.
  -----------------------------------------------------------------------

# 2. Key concepts and terminology

  ----------------------------------------------------------------------------------------
  Term                                Meaning in this module
  ----------------------------------- ----------------------------------------------------
  Meeting category                    Whether the meeting was planned in advance
                                      (Scheduled) or happened without prior scheduling
                                      (Sudden / Ad-Hoc).

  Meeting type                        Who conducted the meeting: Client / DRM, DesignTree
                                      / Arictech, PMC, or Other.

  DRM                                 Design Review Meeting, usually weekly or periodic,
                                      conducted by the client.

  PMC                                 Project Management Consultant.

  MOM                                 Minutes of Meeting: discussion points, decisions,
                                      follow-up requirements, next meeting date, and an
                                      optional uploaded document.

  MOM number                          A reference number generated for every meeting in
                                      the format
                                      MOM-`<project number>`{=html}-`<sequence>`{=html},
                                      for example MOM-2419-013.

  Responsible person                  The SPOC, MEP Coordinator or Structural Design Lead
                                      who owns the meeting, assigned automatically from
                                      the project's committed services.

  Availability response               A team member's reply to an invitation: Available or
                                      Not Available (with a mandatory reason).

  Attendance                          Whether each invited team member actually Attended
                                      or Did Not Attend, marked by the SPOC after the
                                      meeting.

  Action item                         A task arising from the meeting, assigned to a
                                      person with a priority and target date, tracked
                                      until completed.

  Overdue                             An action item whose target date has passed and
                                      whose status is not Completed.
  ----------------------------------------------------------------------------------------

## 2.1 Service codes

Services appear throughout the module as short coloured codes:

  -----------------------------------------------------------------------
  Code                                Service
  ----------------------------------- -----------------------------------
  S                                   Structural

  M                                   Mechanical

  E                                   Electrical

  P                                   Plumbing

  F                                   Fire

  MC                                  MEP Coordination

  SMEPF                               Full Structural + MEP + Fire scope
                                      (used for project scope and
                                      dashboard counts)
  -----------------------------------------------------------------------

# 3. Module layout

The module opens on the SPOC Meetings screen. It has the following
parts:

  -----------------------------------------------------------------------
  Area                                Contents
  ----------------------------------- -----------------------------------
  Header                              Title "Meetings", the SPOC portal /
                                      Employee portal switch, and the two
                                      entry buttons: + Add Sudden Meeting
                                      and + Schedule Meeting.

  Information banner                  Notes that the data is sample data,
                                      with a Reset sample data button
                                      that restores the original
                                      demonstration records.

  Tabs                                Dashboard · All meetings · Action
                                      items (shows a red badge with the
                                      number of overdue items) · Absence
                                      log · Project history.

  Meeting details panel               Opens from the right whenever a
                                      meeting is selected anywhere in the
                                      module. Holds every detail and
                                      action for that one meeting
                                      (section 8).

  Schedule / Add Sudden Meeting form  Opens as a pop-up form over the
                                      page (sections 5 and 6).

  Confirmation messages               A short message appears at the
                                      bottom of the screen after each
                                      save, for example "Meeting
                                      scheduled. Invitations sent to 5
                                      team members."
  -----------------------------------------------------------------------

The panel or form can be closed with the ✕ button, by clicking outside
it, or with the Esc key. The layout adapts to phone and tablet screens,
and supports both light and dark display themes.

Figure 1. SPOC Meetings: Dashboard tab with summary counts, upcoming and
recent meetings, alerts and breakdowns

# 4. Meeting categories, types and responsibility

## 4.1 Meeting categories

  -----------------------------------------------------------------------
  Category                Description             How it is created
  ----------------------- ----------------------- -----------------------
  Scheduled               Meeting planned and     \+ Schedule Meeting.
                          entered in advance.     Starts with status
                                                  Scheduled; selected
                                                  team members receive an
                                                  invitation and respond.

  Sudden / Ad-Hoc         Meeting that happens    \+ Add Sudden Meeting.
                          without prior           Saved directly as held
                          scheduling and is       so attendance and MOM
                          recorded during or      can be entered
                          after the meeting.      immediately. No
                                                  invitation responses
                                                  are collected.
  -----------------------------------------------------------------------

## 4.2 Meeting types

  -----------------------------------------------------------------------
  Meeting type            Conducted by            "Meeting conducted by"
                                                  options offered
  ----------------------- ----------------------- -----------------------
  Client / DRM            Client, weekly or       Client, DRM
                          periodic                

  DesignTree / Arictech   DesignTree / Arictech   DesignTree, Arictech,
                          team                    or any member of the
                                                  project team

  PMC                     Project Management      PMC
                          Consultant              

  Other                   Any other               Other, or any member of
                          project-related meeting the project team
  -----------------------------------------------------------------------

## 4.3 Service-based responsibility

The responsible person for a meeting is not typed in. The system
identifies it from the services committed for the selected project and
the project team, and shows it in the form as soon as the project is
selected:

  -----------------------------------------------------------------------
  Project's committed services        Responsible person (assigned
                                      automatically)
  ----------------------------------- -----------------------------------
  SMEPF services                      Project SPOC coordinates and tracks
                                      the meeting.

  MEP Coordination services only      MEP Coordinator.

  Structural services only            Structural Design Lead / Design
                                      Team.

  Multiple services (not full SMEPF)  Project SPOC, together with the
                                      assigned service-team members who
                                      are selected as participants.
  -----------------------------------------------------------------------

The responsible person is shown on the form with the reason, for example
"Responsible: Ananya Rao · SPOC (SMEPF services)", and is stored on the
meeting. It is also used by the SPOC / Coordinator filter.

# 5. Scheduling a meeting

Select + Schedule Meeting in the header. The Schedule meeting form
opens.

Figure 2. Schedule meeting form

## 5.1 Form fields

  --------------------------------------------------------------------------
  Field             Input type          Required          Behaviour
  ----------------- ------------------- ----------------- ------------------
  Project           Dropdown            Yes               Lists projects as
                                                          `<code>`{=html} ·
                                                          `<name>`{=html}.
                                                          Changing it
                                                          reloads the
                                                          responsible
                                                          person, default
                                                          services,
                                                          "conducted by"
                                                          options and team
                                                          members.

  Meeting type      Dropdown            Yes               Client / DRM,
                                                          DesignTree /
                                                          Arictech, PMC,
                                                          Other. Changes the
                                                          "Meeting conducted
                                                          by" options.

  Responsible SPOC  Auto-populated      ---               Set from the
  / Coordinator     (read-only)                           project's
                                                          committed services
                                                          (section 4.3).

  Meeting title /   Text                Yes               Short subject
  subject                                                 shown on
                                                          invitations, lists
                                                          and the log,
                                                          e.g. "Weekly DRM
                                                          review, Week 41".

  Meeting date      Date                Yes               Defaults to
                                                          tomorrow.

  Start time        Time                Yes               Defaults to 11:00.

  End time          Time                Optional          Defaults to 12:00.
                                                          If entered, it
                                                          must be later than
                                                          the start time.

  Meeting mode      Dropdown            Yes               Online or Offline.
                                                          Switches the next
                                                          field label
                                                          between Meeting
                                                          link and Meeting
                                                          location.

  Meeting link /    Text / URL          Recommended       For online
  location                                                meetings, the link
                                                          is shared with
                                                          participants and
                                                          shown as a
                                                          clickable link
                                                          with a Copy link
                                                          option.

  Meeting conducted Dropdown            Yes               Options depend on
  by                                                      the meeting type
                                                          (section 4.2).

  External          Text                Optional          Client PM,
  participants                                            architect, PMC
                                                          representatives
                                                          etc.

  Services          Multi-select chips  At least one      Pre-selected with
  discussed                                               the project's
                                                          committed
                                                          services; can be
                                                          changed.

  Meeting agenda /  Text area           Optional          Shown to
  purpose                                                 participants and
                                                          in history.

  Project reference File upload         Optional          Drawings, reports
  / documents       (multiple)                            or other
                                                          references shared
                                                          with the selected
                                                          team members along
                                                          with the meeting
                                                          link.

  Project team      Multi-select        At least one      Fetched from the
  members           checklist                             selected project's
                                                          team (section 7).
                                                          All members are
                                                          ticked by default.
                                                          A live count shows
                                                          how many are
                                                          selected.

  Additional        Text                Optional          People who are not
  participants      (comma-separated)                     part of the
                                                          project team.
  --------------------------------------------------------------------------

## 5.2 Validation

When Schedule meeting is pressed, the form checks that it has a meeting
title, a meeting date, an end time later than the start time (if an end
time is given), at least one service and at least one team member.
Anything missing is listed in one message, for example "Add a meeting
title, at least one service to continue." The meeting is not saved until
the message is resolved.

## 5.3 What happens on save

The meeting is created with status Scheduled and a new MOM number.

The responsible person and the organiser (SPOC) are stored on the
meeting.

An invitation is sent to every selected team member, dated today. The
confirmation reads "Meeting scheduled. Invitations sent to N team
members."

The meeting appears in each selected employee's Meeting Dashboard with
all its details, the link and the reference documents, ready for an
Available / Not Available response (section 9).

The meeting appears in Upcoming meetings, All meetings, Project history
and, if within 7 days, Alerts & reminders.

# 6. Adding a sudden / ad-hoc meeting

Select + Add Sudden Meeting. The form is the same as the Schedule
meeting form (section 5.1) with these differences:

  -----------------------------------------------------------------------
  Difference                          Detail
  ----------------------------------- -----------------------------------
  Reason for the sudden meeting       Text area, mandatory. Records what
                                      triggered the meeting (for example,
                                      a site clash or client complaint).

  Recording option                    Two choices: "Meeting is over:
                                      record attendance and MOM now" and
                                      "Meeting in progress: add details
                                      as it runs". Either way the meeting
                                      is entered directly without prior
                                      scheduling and details can be added
                                      during or after the meeting.

  Default date and time               Date defaults to today; start time
                                      to the current hour; end time one
                                      hour later.

  Status on save                      Saved directly as held (Completed),
                                      so the Attendance, MOM and Action
                                      items sections are open straight
                                      away.

  After saving                        The meeting details panel opens
                                      automatically. The confirmation
                                      reads "Sudden meeting saved. Mark
                                      attendance and record the MOM."

  Invitations                         No availability responses are
                                      collected for ad-hoc meetings. In
                                      the meeting list, the Responses
                                      column shows "Ad-hoc".
  -----------------------------------------------------------------------

Validation is the same as for scheduled meetings, plus the reason for
the sudden meeting.

Figure 3. Add sudden meeting form with the mandatory reason and
recording option

Same history. Scheduled and sudden meetings are stored together and
appear side by side in every list, the dashboard counts, the absence log
and the project meeting history. Sudden meetings are labelled "Ad-hoc"
in amber.

# 7. Project team member selection

The Project team members list is linked directly to the Project Team of
the selected project. No separate employee database is kept for
meetings.

The list loads automatically when a project is selected and reloads if
the project changes.

Each entry shows Name, Designation and Department / Service, for example
"Meera Shetty · Mechanical Designer · Mechanical".

Members from Structural, Mechanical, Electrical, Plumbing, Fire, MEP
Coordination and SMEPF are listed according to their project assignment.

Multiple members can be selected; all are selected by default and can be
unticked.

People outside the project team are added through Additional
participants (when scheduling) or Add participant who attended (after
the meeting).

The selected members become: the invitation list (section 9), the
attendance list (section 10), and the list of people action items can be
assigned to (section 12).

# 8. Meeting details panel

Selecting a meeting anywhere in the module (dashboard rows, alerts,
table rows, the From meeting button on an action item) opens the meeting
details panel. It contains every piece of information and every action
for that meeting, in this order.

Figure 4. Details panel for an upcoming scheduled meeting: controls,
details and availability responses

## 8.1 Header

MOM number and project code, meeting title, project name.

Current status (section 13), category, meeting type, date and start--end
time.

Workflow progress tracker with six steps. Completed steps are shaded
green; the next step to do is outlined.

  -----------------------------------------------------------------------
  Step                                Shown as complete when
  ----------------------------------- -----------------------------------
  Planned                             Always (the meeting exists).

  Conducted                           The meeting has been marked held
                                      (status Completed).

  Attendance                          Every selected team member has been
                                      marked Attended or Not attended.

  MOM                                 The MOM has been recorded:
                                      discussion points entered or a MOM
                                      document uploaded.

  Action items                        At least one action item has been
                                      added.

  Tracked                             All action items are Completed.
  -----------------------------------------------------------------------

## 8.2 Meeting controls

  -----------------------------------------------------------------------
  Control                 Available when          Effect
  ----------------------- ----------------------- -----------------------
  Mark meeting held       Meeting not yet held    Sets status to
                          and not cancelled       Completed and opens
                                                  Attendance, MOM and Add
                                                  action item.
                                                  Confirmation: "Marked
                                                  as held. Now mark
                                                  attendance and record
                                                  the MOM."

  Reschedule              Meeting not yet held    Shows an inline box
                          and not cancelled       with New date (defaults
                                                  to one week after the
                                                  meeting date, or after
                                                  today if that date has
                                                  passed) and Time.
                                                  Confirm reschedule
                                                  moves the meeting,
                                                  records the original
                                                  date (shown as "Moved
                                                  from `<date>`{=html}")
                                                  and sets status
                                                  Rescheduled. Keep date
                                                  closes the box.

  Cancel meeting          Meeting not yet held    Shows an inline box
                          and not cancelled       asking for the reason
                                                  for cancelling.
                                                  Confirming sets status
                                                  Cancelled and shows
                                                  "Cancelled:
                                                  `<reason>`{=html}" on
                                                  the panel. Keep meeting
                                                  closes the box.
  -----------------------------------------------------------------------

## 8.3 Sections of the panel

  -----------------------------------------------------------------------
  Section                             Contents
  ----------------------------------- -----------------------------------
  Meeting details                     Mode, link or location (links open
                                      in a new tab), conducted by,
                                      responsible person with role,
                                      services discussed, external
                                      participants, reason for sudden
                                      meeting (ad-hoc only), agenda /
                                      purpose, reference documents.

  Availability responses              Scheduled meetings only. Each
                                      invited member with Available, Not
                                      available (with reason) or Awaiting
                                      response. Section 9.

  Attendance                          Section 10.

  Minutes of meeting                  Section 11.

  Action items                        Section 12.
  -----------------------------------------------------------------------

# 9. Invitations and availability responses

When a scheduled meeting is saved, each selected team member receives an
invitation in their Employee Meeting Dashboard with the project name,
meeting title, date, start and end time, meeting type, meeting link,
agenda, organiser (SPOC), participants and reference documents.

## 9.1 Employee response

Each employee responds Available or Not available. If Not available is
chosen, a reason is mandatory and must be one of:

Another scheduled meeting

Project work / deadline

Leave

Client engagement

Personal reason

Other -- specify (a written explanation is then also mandatory)

When not available, the employee may also add a short note for the SPOC
(for example "can join after 4 PM"). The response can be changed until
the meeting takes place; the latest response is kept with its date.

## 9.2 What the SPOC sees

  -----------------------------------------------------------------------
  Where                               What is shown
  ----------------------------------- -----------------------------------
  Meeting details panel →             Every invited member with name,
  Availability responses              designation and service, and a
                                      status: Available (green), Not
                                      available (red) with the reason, or
                                      Awaiting response (grey). A heading
                                      summary such as "3 available · 1
                                      not available · 1 awaiting" and the
                                      date invitations were sent.

  All meetings → Responses column     The same summary for each scheduled
                                      meeting; "Ad-hoc" for sudden
                                      meetings.

  Dashboard → Alerts & reminders      "N not available:
                                      `<meeting title>`{=html}" for any
                                      upcoming scheduled meeting with a
                                      Not available response; "N
                                      responses awaited:
                                      `<meeting title>`{=html}" when
                                      responses are outstanding and the
                                      meeting is within 2 days.
  -----------------------------------------------------------------------

Response vs attendance. The availability response is the employee's
advance answer. Attendance is what actually happened and is marked
separately by the SPOC after the meeting. The Absence log is based on
attendance.

# 10. Attendance tracking

The Attendance section becomes active once the meeting is marked held
(sudden meetings are held from the start). Before that, it shows
"Available once the meeting is marked held" and the buttons are
disabled.

All selected team members appear automatically, with name, designation
and service.

For each member, choose Attended or Not attended.

Choosing Not attended opens a Reason for absence field directly under
the member; the cursor moves to it. The reason is saved as it is typed.

Add participant who attended: enter a name and organisation and press
Add to record anyone else who attended. They are listed under Additional
participants.

The heading shows a summary such as "4/5 attended". Attendance status
per meeting is one of: All attended, Some absent (at least one member
not marked as attended), or Not marked.

Not-attended entries feed the Absence log (section 16). A Not attended
entry left without a reason is shown there as Not given in red so the
SPOC can follow up.

Figure 5. Completed meeting: details, availability responses and
attendance with a reason for absence

# 11. Minutes of meeting (MOM)

After the meeting, the responsible person records the MOM in the Minutes
of meeting section. The section is available once the meeting is held.

  -----------------------------------------------------------------------
  Field                               Purpose
  ----------------------------------- -----------------------------------
  Key discussion points               Text area for what was discussed.

  Decisions taken                     Text area for decisions agreed in
                                      the meeting.

  Follow-up requirements              Text area for follow-ups (for
                                      example, inputs awaited from the
                                      client).

  Next / follow-up meeting            Date. Triggers a follow-up reminder
                                      in Alerts when within 7 days.

  Upload MOM document                 Accepts PDF, Word and Excel files.
                                      The attached file name is shown
                                      under the field.
  -----------------------------------------------------------------------

Press Save MOM to store it. The MOM counts as recorded when key
discussion points are entered or a MOM document is uploaded. Until then
a completed meeting shows the status "Completed · MOM pending", counts
in the Pending MOM total, and raises a "MOM pending" alert.

Once recorded, the MOM automatically appears in the Meeting Log of every
invited employee, who can view the discussion points and decisions and
download the MOM (section 17).

Figure 6. MOM entry and action items for a completed meeting

# 12. Action items

## 12.1 Adding an action item

In the meeting details panel (after the meeting is held), fill in Add
action item and press Add action item:

  -----------------------------------------------------------------------
  Field                   Input                   Rules
  ----------------------- ----------------------- -----------------------
  Action / task           Text                    Required. Message
                                                  "Enter the task first."
                                                  if empty.

  Responsible person      Dropdown                Project team members
                                                  plus any additional
                                                  participants of the
                                                  meeting.

  Department / Service    Dropdown                Filled automatically
                                                  from the selected
                                                  person's service; can
                                                  be changed.

  Priority                Dropdown                High, Medium (default),
                                                  Low.

  Target date             Date                    Defaults to one week
                                                  from today.

  Remarks                 Text                    Optional.
  -----------------------------------------------------------------------

A new action item starts with status Pending. The confirmation reads
"Action item assigned to `<name>`{=html}." The item immediately appears
in the SPOC Action items tab and in the assignee's My action items list.

## 12.2 Action item record

  -----------------------------------------------------------------------
  Attribute                           Description
  ----------------------------------- -----------------------------------
  Action / task                       What has to be done.

  Responsible person                  Assignee.

  Department / Service                Shown as a service code.

  Priority                            High (red), Medium (amber), Low
                                      (grey).

  Target date                         Shown in red with "Nd overdue" when
                                      overdue, amber when due within 3
                                      days.

  Status                              Pending / In Progress / Completed,
                                      editable from the meeting panel,
                                      the SPOC Action items tab, or by
                                      the assignee.

  Remarks                             SPOC remarks, plus the assignee's
                                      latest progress note shown as
                                      "Update from `<name>`{=html}: ...".

  Completion date                     Set automatically to today when
                                      status changes to Completed;
                                      cleared if the status is moved
                                      back.
  -----------------------------------------------------------------------

## 12.3 Automatic overdue tracking

Overdue: target date earlier than today and status not Completed.
Counted in Overdue action items, shown on the Action items tab badge,
flagged in red, and raised as an alert "Overdue Nd:
```{=html}
<task>
```
".

Due soon: target date today or within the next 3 days and not Completed.
Shown in amber and raised as an alert "Due `<date>`{=html}:
```{=html}
<task>
```
".

# 13. Meeting status lifecycle

Each meeting stores one of four statuses: Scheduled, Completed,
Rescheduled, Cancelled. The screens display a more specific label
derived from the status, date and MOM:

  -----------------------------------------------------------------------
  Displayed status        Colour                  Condition
  ----------------------- ----------------------- -----------------------
  Upcoming                Teal                    Status Scheduled and
                                                  the meeting date is
                                                  today or later.

  Rescheduled             Amber                   Status Rescheduled and
                                                  the new date is today
                                                  or later.

  Awaiting update         Grey                    Status Scheduled or
                                                  Rescheduled but the
                                                  date has passed and the
                                                  meeting has not been
                                                  marked held. The SPOC
                                                  should mark it held,
                                                  reschedule or cancel
                                                  it.

  Completed · MOM pending Amber                   Meeting held but the
                                                  MOM has not been
                                                  recorded.

  Completed               Green                   Meeting held and MOM
                                                  recorded.

  Cancelled               Red                     Meeting cancelled (with
                                                  reason).
  -----------------------------------------------------------------------

Typical flow: Scheduled (Upcoming) → optionally Rescheduled → Completed
· MOM pending → Completed. A meeting can be cancelled at any point
before it is held.

# 14. Dashboard tab

## 14.1 Meeting summary counts

A row of counts across all projects. Each count can be clicked to open
the relevant filtered list.

  -----------------------------------------------------------------------
  Count                   Definition              Click opens
  ----------------------- ----------------------- -----------------------
  Total meetings          All meetings, both      All meetings, no filter
                          categories.             

  Scheduled               Meetings of category    All meetings filtered
                          Scheduled.              to Scheduled

  Sudden / ad-hoc         Meetings of category    All meetings filtered
                          Sudden / Ad-Hoc.        to Sudden

  Upcoming                Scheduled or            All meetings filtered
                          Rescheduled with date   to Upcoming
                          today or later.         

  Completed               Meetings marked held.   All meetings filtered
                          Shown in green.         to Completed

  Cancelled / rescheduled Status Cancelled or     All meetings filtered
                          Rescheduled.            to Cancelled or
                                                  rescheduled

  Pending MOM             Held meetings without a All meetings filtered
                          recorded MOM. Amber     to Completed · MOM
                          when above zero.        pending

  Pending action items    Action items not        Action items tab
                          Completed.              

  Overdue action items    Open action items past  Action items tab
                          target date. Red when   
                          above zero.             

  Absences recorded       Members marked Not      Absence log tab
                          attended across all     
                          meetings. Amber if any  
                          has no reason.          
  -----------------------------------------------------------------------

## 14.2 Panels

  -----------------------------------------------------------------------
  Panel                               Contents
  ----------------------------------- -----------------------------------
  Upcoming meetings                   All upcoming meetings in date and
                                      time order: date, title, project,
                                      type, category, start time, service
                                      codes, status.

  Recent meetings                     The five most recent meetings that
                                      are no longer upcoming, newest
                                      first.

  Alerts & reminders                  All current alerts with a coloured
                                      dot (teal information, amber
                                      attention, red overdue). Selecting
                                      an alert opens the meeting. Section
                                      15.

  By meeting type                     Bar chart of meetings per type:
                                      Client / DRM, DesignTree /
                                      Arictech, PMC, Other. Clicking a
                                      bar filters All meetings by that
                                      type.

  By service                          Bar chart of meetings per service:
                                      Structural, Mechanical, Electrical,
                                      Plumbing, Fire, MEP Coordination (a
                                      meeting counts under every service
                                      it discussed) and SMEPF (meetings
                                      on projects with full SMEPF scope).
                                      Clicking a bar filters All meetings
                                      by that service.
  -----------------------------------------------------------------------

# 15. Notifications, alerts and reminders

Alerts are calculated automatically every time the screen is refreshed.
They appear in the Alerts & reminders panel on the Dashboard.

  -----------------------------------------------------------------------
  Alert                   Raised when             Level
  ----------------------- ----------------------- -----------------------
  Today / Tomorrow / In N An upcoming meeting is  Information
  days: `<type>`{=html}   within the next 7 days. 
  meeting                                         

  N not available:        An upcoming scheduled   Attention
                          meeting has one or more 
                          Not available           
                          responses.              

  N responses awaited:    Responses are still     Information
                          awaited and the meeting 
                          is within 2 days.       

  MOM pending             A meeting has been held Attention
                          but no MOM is recorded. 
                          Shows the responsible   
                          person.                 

  Overdue Nd:             An action item is past  Overdue (red)
                          its target date and not 
                          Completed. Shows the    
                          owner and project.      

  Due `<date>`{=html}:    An action item is due   Attention
                          within 3 days.          

  Follow-up meeting due   A MOM's next /          Information
  `<date>`{=html}         follow-up meeting date  
                          falls in the next 7     
                          days.                   

  Cancelled /             A meeting dated within  Attention
  Rescheduled:            14 days either side of  
  `<type>`{=html} meeting today was cancelled     
                          (shows reason) or       
                          rescheduled (shows new  
                          date).                  
  -----------------------------------------------------------------------

Employees see their own reminders in the Employee Meeting Dashboard:
today's meetings, pending responses, assigned action items and due or
overdue items.

# 16. Lists and logs

## 16.1 All meetings tab

A table of all meetings, newest first, with the filters described below.
The count above the table shows "N of M meetings", and Clear filters
appears when any filter is set. Clicking a row opens the meeting.

  Column              Content
  ------------------- -------------------------------------------------
  Date                Date and start time.
  MOM no.             Meeting reference.
  Meeting / project   Meeting title and project name.
  Category            Scheduled or Ad-hoc.
  Type                Meeting type.
  Services            Service codes discussed.
  Responsible         SPOC / coordinator.
  Responses           Availability summary (scheduled) or "Ad-hoc".
  Attendance          "N/M attended", Not marked, or ---.
  Actions             Number of open action items and number overdue.
  Status              Displayed status (section 13).

### Filters

  -----------------------------------------------------------------------
  Filter                              Options
  ----------------------------------- -----------------------------------
  Project                             All, or one project.

  Category                            Scheduled, Sudden / Ad-Hoc.

  Meeting type                        Client / DRM, DesignTree /
                                      Arictech, PMC, Other.

  Service                             Structural, Mechanical, Electrical,
                                      Plumbing, Fire, MEP Coordination,
                                      SMEPF (project scope).

  SPOC / coordinator                  Each responsible person.

  From / To                           Meeting date range.

  Meeting status                      Upcoming, Scheduled, Completed,
                                      Completed · MOM pending,
                                      Rescheduled, Cancelled, Cancelled
                                      or rescheduled.

  Attendance                          All attended, Some absent, Not
                                      marked.

  Action items                        Has pending, Has overdue, All
                                      completed, No action items.
  -----------------------------------------------------------------------

Figure 7. All meetings tab with filters and the Responses column

## 16.2 Action items tab

All action items from all meetings in one table, sorted by target date.
Filters: Status (All, Open = Pending + In Progress, Overdue, Pending, In
Progress, Completed) and Project. Columns: Action / task, Responsible,
Service, Priority, Target (with overdue days), Status (editable
dropdown), Completed date, Remarks (with the assignee's latest update),
and From meeting (button that opens the source meeting). Changing a
status here shows "Status set to `<status>`{=html}."

Figure 8. Action items tab across all meetings

## 16.3 Absence log tab

A log of every team member marked Not attended, with project, service,
reason and the full meeting details. It is built automatically from the
attendance marked on held meetings.

### Filters

Project, Service (of the absent member), Team member, Meeting type, and
From / To date range.

### Summaries

Absences by team member: name, service, number of absences (highlighted
when more than one) and the projects concerned. Clicking a member
filters the log to that person.

By service: bar chart of absences per service. Clicking a bar filters
the log to that service.

### Log columns

  -----------------------------------------------------------------------
  Column                              Content
  ----------------------------------- -----------------------------------
  Date                                Meeting date and time.

  MOM no.                             Meeting reference.

  Project                             Project name and code.

  Absent member                       Name and designation.

  Service                             Member's service.

  Reason for absence                  As entered in attendance; "Not
                                      given" in red if blank.

  Meeting                             Meeting type, category and services
                                      discussed.

  Mode / location                     Online with link, or Offline with
                                      location.

  Responsible                         Responsible person and who
                                      conducted the meeting.

  Agenda                              Meeting agenda / purpose.
  -----------------------------------------------------------------------

### Copy log for Excel

Copies the currently filtered log to the clipboard as a table that
pastes directly into Excel with 17 columns: Date, Time, MOM no.,
Project, Project code, Meeting category, Meeting type, Mode, Location /
link, Conducted by, Responsible, Services discussed, Agenda, Absent
member, Designation, Service, Reason for absence. If the browser blocks
copying, the text is shown selected so it can be copied with Ctrl+C.

Figure 9. Absence log with summaries by member and service

## 16.4 Project history tab

Select a project to see its complete meeting history in chronological
order. Above the table: client name, project scope (service codes) and
the responsible person with role. Scheduled and sudden meetings appear
together.

  -----------------------------------------------------------------------
  Column                              Content
  ----------------------------------- -----------------------------------
  Date                                Meeting date.

  Category                            Scheduled / Ad-hoc.

  Type                                Meeting type.

  Service                             Services discussed.

  Participants                        Selected team members, plus
                                      additional participants.

  Attendance                          Attendance summary.

  Key discussions                     First part of the MOM discussion
                                      points, or the agenda if no MOM
                                      yet.

  MOM                                 Recorded, Pending, or ---.

  Action items                        "N/M done".

  Status                              Displayed status.
  -----------------------------------------------------------------------

Clicking a row opens the complete meeting details.

Figure 10. Project meeting history

# 17. Link with the Employee Meeting Dashboard

The SPOC module works together with a separate Employee Meeting
Dashboard used by project team members (excluding the SPOC). In the
prototype the two can be viewed in one page using the SPOC portal /
Employee portal switch; a standalone employee page is also available.
Both read the same meetings.

  -----------------------------------------------------------------------
  SPOC action             Result for the employee Result back to the SPOC
  ----------------------- ----------------------- -----------------------
  Schedules a meeting and Invitation appears in   Responses section shows
  selects team members    the employee's Meeting  "Awaiting response" for
                          invitations and         each member.
                          Overview, with project, 
                          title, date, start--end 
                          time, type, link (with  
                          Copy link), agenda,     
                          organiser, participants 
                          and documents.          

  ---                     Employee responds       Response and reason
                          Available / Not         appear in the
                          available; reason       Availability responses
                          mandatory if not        section, Responses
                          available.              column and alerts.

  Marks meeting held and  Meeting moves           Absence log updates.
  marks attendance        automatically into the  
                          employee's Meeting log  
                          with attendance,        
                          unavailable members and 
                          reasons.                

  Records or uploads the  MOM appears in the      ---
  MOM                     employee's Meeting log: 
                          discussion points,      
                          decisions, follow-up,   
                          next meeting, and a     
                          Download MOM option.    

  Assigns action items    Item appears in the     ---
                          employee's My action    
                          items with due date and 
                          priority, and is        
                          highlighted in the      
                          meeting.                

  ---                     Employee updates        Status and "Update from
                          action-item status and  `<name>`{=html}" appear
                          adds a progress note.   in the SPOC Action
                                                  items tab and the
                                                  meeting panel.
  -----------------------------------------------------------------------

## 17.1 Employee dashboard views (summary)

Overview: counts for today's meetings, upcoming meetings, pending
responses, open and overdue action items, and meetings attended; today's
meetings with links; pending responses; open action items.

Meeting invitations: meetings received from the SPOC, filterable by all
/ awaiting my response / responded, each with the Available / Not
available response form.

Meeting log: completed and past meetings with date and time, link,
organiser, invited count, who attended, who was unavailable and why, own
attendance, meeting status and MOM status. Filters by project and MOM
availability.

My action items: actions arising from MOMs, with project, source
meeting, priority, due date, status update and a progress note for the
SPOC.

# 18. End-to-end workflows

## 18.1 Scheduled meeting

  -----------------------------------------------------------------------
  Step              Who               Where             Action and system
                                                        response
  ----------------- ----------------- ----------------- -----------------
  1\. Schedule      SPOC              Header button     Opens the
  Meeting                                               Schedule meeting
                                                        form.

  2\. Select        SPOC              Form              Responsible
  Project                                               person, default
                                                        services and the
                                                        project team load
                                                        automatically.

  3\. Select        SPOC              Form              "Conducted by"
  Meeting Type                                          options update.

  4\. Select        SPOC              Form              Adjust the
  Service                                               pre-selected
                                                        services
                                                        discussed.

  5\. Select        SPOC              Form              Tick team
  Participants                                          members; add
                                                        external and
                                                        additional
                                                        participants;
                                                        attach reference
                                                        documents; save.

  6\. Invitations   System            Employee          Selected members
  sent                                dashboards        receive the
                                                        meeting details
                                                        and link.

  7\. Respond       Employees         Employee          Available / Not
                                      dashboard         available with
                                                        mandatory reason.
                                                        SPOC sees
                                                        responses and
                                                        alerts.

  8\. Conduct       SPOC              Details panel     Mark meeting held
  Meeting                                               (or Reschedule /
                                                        Cancel
                                                        beforehand).

  9\. Mark          SPOC              Attendance        Attended / Not
  Attendance                          section           attended with
                                                        reason; add extra
                                                        attendees.

  10\. Enter MOM    SPOC              MOM section       Discussion,
                                                        decisions,
                                                        follow-up, next
                                                        meeting date,
                                                        upload document.
                                                        Save MOM. MOM is
                                                        reflected in
                                                        employees'
                                                        Meeting log.

  11\. Add Action   SPOC              Action items      Task, person,
  Items                               section           service,
                                                        priority, target
                                                        date, remarks.

  12\. Assign       System            Employee          Item appears in
  Responsibility                      dashboards        the assignee's My
                                                        action items.

  13\. Track        Employee and SPOC Action items tabs Status updates
  Completion                                            and progress
                                                        notes; overdue
                                                        tracked
                                                        automatically
                                                        until Completed.
  -----------------------------------------------------------------------

## 18.2 Sudden / ad-hoc meeting

  -----------------------------------------------------------------------
  Step                    Who                     Action and system
                                                  response
  ----------------------- ----------------------- -----------------------
  1\. Add Sudden Meeting  SPOC                    Opens the Add sudden
                                                  meeting form.

  2\. Select Project      SPOC                    Responsible person and
                                                  team load
                                                  automatically.

  3\. Enter Meeting       SPOC                    Title, type, date and
  Details                                         time, mode and
                                                  location, services,
                                                  agenda, and the
                                                  mandatory reason for
                                                  the sudden meeting;
                                                  choose whether it is
                                                  over or in progress.

  4\. Select Participants SPOC                    Tick the team members
                                                  present; add others.
                                                  Save. The details panel
                                                  opens.

  5\. Mark Attendance     SPOC                    Attended / Not attended
                                                  with reasons.

  6\. Enter MOM           SPOC                    Record or upload the
                                                  MOM, during or after
                                                  the meeting.

  7\. Add Action Items    SPOC                    Create tasks with
                                                  owner, priority and
                                                  target date.

  8\. Assign              System                  Items appear in the
  Responsibility                                  assignees' dashboards.

  9\. Track Completion    Employee and SPOC       Status updates until
                                                  Completed; overdue
                                                  tracked automatically.
  -----------------------------------------------------------------------

# 19. Business rules summary and production notes

## 19.1 Business rules

  -----------------------------------------------------------------------
  \#                                  Rule
  ----------------------------------- -----------------------------------
  R1                                  The responsible person is assigned
                                      from the project's committed
                                      services (SMEPF → SPOC; MEP
                                      Coordination only → MEP
                                      Coordinator; Structural only →
                                      Structural Design Lead; multiple →
                                      SPOC with service leads).

  R2                                  Team members are selected only from
                                      the selected project's team; others
                                      are added as additional
                                      participants.

  R3                                  A meeting needs a title, date, at
                                      least one service and at least one
                                      team member; end time must be after
                                      start time.

  R4                                  A sudden meeting needs a reason and
                                      is saved as held.

  R5                                  Invitations go to selected members
                                      of scheduled meetings only.

  R6                                  A Not available response requires a
                                      reason from the list; "Other --
                                      specify" also requires text.

  R7                                  Attendance, MOM and action items
                                      can be entered only after the
                                      meeting is held.

  R8                                  A MOM is recorded when discussion
                                      points are entered or a document is
                                      uploaded.

  R9                                  An action item is overdue when its
                                      target date has passed and it is
                                      not Completed; due soon within 3
                                      days.

  R10                                 Completion date is set
                                      automatically when an action item
                                      is marked Completed and cleared if
                                      reopened.

  R11                                 Reschedule and cancel are allowed
                                      only before a meeting is held;
                                      rescheduling keeps the original
                                      date.

  R12                                 Scheduled and sudden meetings share
                                      one history per project.
  -----------------------------------------------------------------------

## 19.2 Current prototype limitations

Projects, team members and meetings are sample data held in the page.

Data is saved in the browser on the computer where it was entered; it is
not shared between users or computers. Reset sample data restores the
demonstration data.

Uploaded MOM and reference documents are recorded by file name only; the
files themselves are not stored.

Notifications appear inside the dashboards; no email or mobile
notifications are sent.

The SPOC / Employee portal switch and the "Viewing as" selector are for
demonstration and would be replaced by user login.

## 19.3 Recommendations for the production build

Connect projects, committed services and Project Team to the live
project master so team lists and responsibility load from real
assignments.

Store meetings, responses, attendance, MOMs and action items in a shared
database so SPOCs and employees see the same records.

Add user login with role-based access (SPOC / Coordinator / Lead vs
employee).

Store uploaded MOM and reference documents in the document management
system and link them to the meeting.

Send invitations, reminders, MOM-published and overdue alerts by email
and/or in-app notification, optionally with calendar invites.

Keep an audit trail of changes to meetings, attendance and action-item
statuses.

------------------------------------------------------------------------

# Employee Meetings Module --- Functional Documentation

DESIGNTREE SERVICE CONSULTANTS

Employee Meetings Module

Functional documentation: Employee Meeting Dashboard features, screens,
rules and workflow

  -----------------------------------------------------------------------
  Item                                Detail
  ----------------------------------- -----------------------------------
  Module                              Employee Meeting Dashboard ("My
                                      Meetings")

  Document type                       Functional specification and user
                                      guide

  Version documented                  Version 1.1 (latest), including the
                                      display fixes of 7 October 2026

  Document date                       7 October 2026

  Related module                      SPOC Meetings module (documented
                                      separately in "SPOC Meetings Module
                                      -- Functional Documentation")

  Prepared for                        DesignTree / Arictech project team
                                      members, SPOCs, coordinators and
                                      the development team
  -----------------------------------------------------------------------

# Contents

Right-click the table above and choose Update Field if page numbers are
not shown.

# 1. Introduction

## 1.1 Purpose of this document

This document describes the Employee Meetings module in full: every
screen, field and control, the rules the system applies, and how
meetings, responses, MOMs and action items flow between the SPOC and the
employee. It is written so that the complete behaviour can be understood
without opening the dashboard.

## 1.2 Objective of the module

The Employee Meeting Dashboard gives every project team member (other
than the SPOC) one place to manage and track the project meetings the
SPOC has assigned to them. Employees receive meeting details and links,
confirm whether they are available, see the meeting log and the MOM
after each meeting, and update the action items assigned to them.

## 1.3 Users

  -----------------------------------------------------------------------
  User                                Use of the module
  ----------------------------------- -----------------------------------
  Project team members (employees)    Structural, Mechanical, Electrical,
                                      Plumbing, Fire and MEP Coordination
                                      engineers, designers, modellers and
                                      draughtsmen assigned to projects.
                                      They are the users of this
                                      dashboard.

  SPOC / Coordinator / Structural     Not a user of this dashboard for
  Lead                                the meetings they organise. They
                                      schedule meetings, select
                                      participants, record attendance and
                                      MOM, and assign action items from
                                      the SPOC Meetings module, and they
                                      see the employees' responses and
                                      updates there.
  -----------------------------------------------------------------------

## 1.4 Scope

Covered: how meetings reach an employee, the Overview, Meeting
invitations, Meeting log and My action items views, the Available / Not
Available response with mandatory reasons, the meeting details panel,
MOM viewing and download, action-item updates, statuses, reminders, the
end-to-end workflow and business rules.

Prototype note. The module has been built as a working interactive
prototype with sample projects, people and meetings. It is available as
a standalone Employee Meeting Dashboard page and as the Employee portal
inside the combined SPOC and Employee dashboard; both behave the same.
Data entered is saved only in the browser where it was entered (section
16).

## 1.5 Version history

  -----------------------------------------------------------------------
  Version                 Date                    Changes
  ----------------------- ----------------------- -----------------------
  1.0                     1 Oct 2026              Employee Meeting
                                                  Dashboard created:
                                                  Overview, Meeting
                                                  invitations with
                                                  Available / Not
                                                  Available responses and
                                                  mandatory reasons,
                                                  Meeting log with
                                                  attendance,
                                                  unavailability and MOM
                                                  status, MOM viewing and
                                                  download, My action
                                                  items with status
                                                  update and progress
                                                  notes. Linked to the
                                                  SPOC module through the
                                                  Employee portal, and
                                                  published as a
                                                  standalone page.

  1.1                     7 Oct 2026              Display fixes: the
                                                  Available / Not
                                                  available buttons are
                                                  now sized to their
                                                  labels instead of
                                                  stretching across the
                                                  card; the "YOU" tag in
                                                  the attendance list
                                                  sits beside the
                                                  employee's name;
                                                  action-item status
                                                  dropdowns are wide
                                                  enough to show "In
                                                  Progress" in full.
  -----------------------------------------------------------------------

# 2. Key terms

  ----------------------------------------------------------------------------------------
  Term                                Meaning in this module
  ----------------------------------- ----------------------------------------------------
  Invitation                          A scheduled meeting for which the SPOC has selected
                                      the employee as a participant. It appears in the
                                      employee's dashboard automatically.

  Organiser (SPOC)                    The person who scheduled and owns the meeting: the
                                      SPOC, MEP Coordinator or Structural Design Lead,
                                      depending on the project's services.

  Availability response               The employee's answer to an invitation: Available or
                                      Not available. Not available always carries a
                                      reason.

  Attendance                          Whether the employee actually attended, marked by
                                      the SPOC after the meeting. It can differ from the
                                      availability response.

  Meeting log                         The list of the employee's meetings that have been
                                      held, cancelled or whose date has passed.

  MOM                                 Minutes of Meeting recorded or uploaded by the SPOC:
                                      discussion points, decisions, follow-up, next
                                      meeting and MOM document.

  MOM number                          Meeting reference in the format
                                      MOM-`<project number>`{=html}-`<sequence>`{=html},
                                      for example MOM-2460-004.

  Action item                         A task from the MOM assigned to a person with
                                      priority and due date.

  Scheduled / Ad-hoc                  Scheduled meetings are planned in advance and send
                                      invitations. Ad-hoc (sudden) meetings are recorded
                                      by the SPOC during or after the meeting and do not
                                      ask for availability.
  ----------------------------------------------------------------------------------------

## 2.1 Service codes

  Code   Service
  ------ ------------------
  S      Structural
  M      Mechanical
  E      Electrical
  P      Plumbing
  F      Fire
  MC     MEP Coordination

# 3. How meetings reach the employee

The employee does not create meetings. Every meeting in the dashboard
comes from the SPOC Meetings module:

The SPOC schedules a meeting from the SPOC portal, selecting the
project, title, date, start and end time, type, link or location,
agenda, services and reference documents.

While creating the meeting, the SPOC selects the required project team
members. The list comes from the project's team, showing name,
designation and service.

When the meeting is saved, it appears automatically in each selected
employee's Meeting Dashboard as an invitation dated that day.

The employee sees all meeting details, including the meeting link shared
by the SPOC and any reference documents.

An employee sees only meetings in which they were selected as a team
member. Meetings of other projects, or meetings they were not selected
for, do not appear.

## 3.1 Information exchanged with the SPOC module

  -----------------------------------------------------------------------
  From SPOC to employee               From employee to SPOC
  ----------------------------------- -----------------------------------
  Meeting details, link and reference Available / Not available response
  documents                           with reason and optional note

  Reschedule or cancellation (with    Action-item status changes
  reason)                             (Pending, In Progress, Completed)

  Attendance marked after the meeting Progress notes on action items

  MOM: discussion, decisions,         
  follow-up, next meeting, document   

  Action items assigned to the        
  employee with due dates             
  -----------------------------------------------------------------------

# 4. Dashboard layout

  -----------------------------------------------------------------------
  Area                                Contents
  ----------------------------------- -----------------------------------
  Header                              Title "My Meetings" with the
                                      employee's name, designation and
                                      service, for example "Rohit
                                      Kulkarni · Electrical Engineer ·
                                      Electrical".

  Viewing as (demo)                   Prototype only: a dropdown to
                                      switch between sample employees. In
                                      production this is replaced by the
                                      employee's login. The list contains
                                      all project team members except
                                      Project SPOCs. The choice is
                                      remembered on that browser.

  Information banner                  Notes that the data is sample data,
                                      with Reset sample data to restore
                                      the demonstration records.

  Tabs                                Overview · Meeting invitations (red
                                      badge "N awaiting" when responses
                                      are pending) · Meeting log · My
                                      action items (red badge "N overdue"
                                      when any item is overdue).

  Meeting details panel               Opens from the right when any
                                      meeting is selected (section 7).

  Confirmation messages               Short messages at the bottom of the
                                      screen after an action, for example
                                      "Response sent to Sneha Gowda."
  -----------------------------------------------------------------------

The panel can be closed with ✕, by clicking outside it, or with Esc. The
dashboard works on desktop, tablet and phone screens, in light and dark
display themes. The last tab used is remembered.

# 5. Overview tab

The Overview is the employee's landing page. It summarises today, what
needs a response, and what work is open.

Figure 1. Overview tab

## 5.1 Summary counts

  -----------------------------------------------------------------------
  Count                   Definition              Click opens
  ----------------------- ----------------------- -----------------------
  Today's meetings        The employee's upcoming Meeting invitations
                          meetings dated today.   

  Upcoming meetings       Meetings with status    Meeting invitations
                          Scheduled or            
                          Rescheduled and a date  
                          of today or later.      

  Pending responses       Upcoming scheduled      Meeting invitations
                          meetings the employee   
                          has not yet responded   
                          to. Amber when above    
                          zero.                   

  Open action items       Action items assigned   My action items
                          to the employee that    
                          are Pending or In       
                          Progress.               

  Overdue action items    Open items whose due    My action items
                          date has passed. Red    
                          when above zero.        

  Meetings attended       Meetings in the log     Meeting log
                          where the SPOC marked   
                          the employee as         
                          Attended. Green.        
  -----------------------------------------------------------------------

## 5.2 Panels

  -----------------------------------------------------------------------
  Panel                               Contents
  ----------------------------------- -----------------------------------
  Today's meetings                    A full invitation card for each
                                      meeting today, with the meeting
                                      link, details and the availability
                                      response form (section 6.2). Shows
                                      "No meetings today." if there are
                                      none.

  Upcoming meetings                   Other upcoming meetings (after
                                      today) in date order: date, title,
                                      project, start--end time, type, and
                                      the employee's response status.
                                      Selecting a row opens the meeting.

  Pending availability responses      Meetings still waiting for the
                                      employee's response, with a
                                      reminder that a reason is required
                                      if not available. Shows "You have
                                      responded to every invitation."
                                      when clear.

  My action items                     Up to five open action items,
                                      nearest due date first, with due
                                      date, overdue days, status and
                                      project. Red dot = overdue; amber =
                                      due within 3 days. Selecting one
                                      opens its meeting.
  -----------------------------------------------------------------------

# 6. Meeting invitations

This tab lists every upcoming meeting the SPOC has invited the employee
to, as full cards. A filter at the top switches between All upcoming,
Awaiting my response and Responded.

Figure 2. Meeting invitations tab

## 6.1 Meeting details on each invitation

  -----------------------------------------------------------------------
  Detail                              Description
  ----------------------------------- -----------------------------------
  Project name                        Project code and name, for example
                                      "DT-2460 · City Care Hospital
                                      Annex".

  Meeting title / subject             As entered by the SPOC.

  Date                                Shown as Today, Tomorrow or the
                                      date.

  Start time & end time               For example "10:30 AM--12:00 PM".

  Meeting type                        Client / DRM, DesignTree /
                                      Arictech, PMC or Other; plus mode
                                      (Online / Offline).

  Meeting link                        For online meetings, a clickable
                                      link that opens in a new tab, with
                                      a Copy link button ("Meeting link
                                      copied."). For offline meetings,
                                      the location.

  Meeting agenda / purpose            As entered by the SPOC.

  Organised by (SPOC)                 The meeting organiser.

  Services                            Service codes for the services to
                                      be discussed.

  Participants / team members         All selected team members and
                                      additional participants; the
                                      employee's own name is tagged
                                      "YOU".

  Reference documents                 Project references or documents
                                      shared by the SPOC with the
                                      invitation.

  Invitation received                 Date the SPOC sent the invitation,
                                      and the MOM number.

  Response status                     Top-right label: Response needed
                                      (amber), You: available (green) or
                                      You: not available (red).
  -----------------------------------------------------------------------

## 6.2 Responding to an invitation

Each invitation for a scheduled meeting has a Your availability box:

Choose Available or Not available.

If Not available is chosen, two fields appear: Reason (required) and a
text field. The text field is labelled "Note for SPOC (optional)" for
most reasons, and "Specify reason (required)" when the reason is Other
-- specify.

Press Send response. The message "Response sent to
`<organiser>`{=html}." appears, the status label changes, and the box
shows "Sent `<date>`{=html} to `<organiser>`{=html}".

To change the answer later, edit the choice and press Update response.
Responses can be changed until the meeting moves to the meeting log.

### Reasons for non-availability

  Reason                      Extra text
  --------------------------- ----------------------
  Another scheduled meeting   Optional note
  Project work / deadline     Optional note
  Leave                       Optional note
  Client engagement           Optional note
  Personal reason             Optional note
  Other -- specify            Required description

### Validation messages

  -----------------------------------------------------------------------
  Situation                           Message shown
  ----------------------------------- -----------------------------------
  Send pressed with no choice made    Choose Available or Not available.

  Not available chosen without a      Select a reason for not being
  reason                              available.

  Other -- specify chosen without a   Describe the reason.
  description                         
  -----------------------------------------------------------------------

The response is not sent until the message is resolved.

Figure 3. Not available chosen without a reason: the response is blocked

Figure 4. Other -- specify requires a written reason

Figure 5. Response sent: status changes to "You: not available" and the
send date is shown

## 6.3 What the SPOC sees

Each response appears immediately in the SPOC module: in the meeting's
Availability responses section (name, Available / Not available /
Awaiting response, and the reason with any note), in the Responses
column of the meeting list, and as alerts for meetings with members not
available or responses still awaited.

When no response is asked. Ad-hoc (sudden) meetings are recorded by the
SPOC during or after the meeting, so they do not ask for availability
and go straight to the meeting log. Cancelled meetings also do not show
the response box.

# 7. Meeting details panel

Selecting a meeting from any list opens the details panel. Its sections
depend on the stage of the meeting.

  -----------------------------------------------------------------------
  Section                 Shown when              Contents
  ----------------------- ----------------------- -----------------------
  Header                  Always                  MOM number, project
                                                  code, meeting title,
                                                  project, meeting
                                                  status, the employee's
                                                  response status, type,
                                                  date and start--end
                                                  time.

  Your availability       Upcoming scheduled      The same response form
                          meetings                as on the invitation
                                                  card (section 6.2).

  Cancellation notice     Cancelled meetings      "Cancelled by SPOC:
                                                  `<reason>`{=html}".

  Meeting details         Always                  Project, date,
                                                  start--end, meeting
                                                  type and category,
                                                  meeting link (with Copy
                                                  link) or location,
                                                  organiser, services,
                                                  agenda, participants
                                                  ("YOU" tag) and
                                                  reference documents.

  Attendance              After the meeting is    Every invited member
                          held                    with Attended / Not
                                                  attended / Not marked,
                                                  the reason for absence
                                                  where given, and
                                                  additional
                                                  participants. The
                                                  heading shows "N/M
                                                  attended".

  Minutes of meeting      Meetings in the log     See section 9.
                          (not cancelled)         

  Action items            When the meeting has    All action items of the
                          action items            meeting; the employee's
                                                  own are highlighted and
                                                  tagged "YOU", with an
                                                  editable status.
                                                  Others' items are
                                                  read-only. The heading
                                                  shows "N assigned to
                                                  you".
  -----------------------------------------------------------------------

Figure 6. Details panel for an upcoming meeting, with the response form

Figure 7. Details panel for a completed meeting: attendance, MOM with
download, and the employee's action item

# 8. Meeting log

After the meeting, it moves automatically from invitations into the
Meeting log. A meeting is in the log when the SPOC has marked it held,
when it has been cancelled, or when its date has passed. The log is
sorted newest first.

## 8.1 Filters

Project: all of the employee's projects, or one project.

MOM: All, MOM available, or MOM pending (meeting held but MOM not yet
recorded).

## 8.2 Columns

  -----------------------------------------------------------------------
  Column                              Content
  ----------------------------------- -----------------------------------
  Date & time                         Meeting date, start--end time.

  Project                             Project name.

  Meeting                             Meeting title and type.

  Link                                Meeting link for online meetings,
                                      or "Offline: `<location>`{=html}".

  Organiser                           SPOC / meeting organiser.

  Invited                             Number of invited participants
                                      (team members plus additional
                                      participants).

  Attended                            Names of participants marked
                                      Attended (including additional
                                      participants); "Not marked" if
                                      attendance is not yet entered; ---
                                      if not held.

  Unavailable & reason                Each employee who was unavailable
                                      with the reason. Uses the absence
                                      reason from attendance; if none was
                                      entered, the reason from their Not
                                      available response; "Not given" if
                                      neither exists. For meetings not
                                      yet marked held, lists Not
                                      available responses.

  You                                 The employee's own attendance:
                                      Attended, Absent or Not marked.

  Status                              Meeting status (section 11).

  MOM                                 Available (green), Pending (amber)
                                      or ---.
  -----------------------------------------------------------------------

Selecting a row opens the meeting details panel with the full
attendance, MOM and action items.

Figure 8. Meeting log

# 9. MOM integration

The MOM prepared and uploaded by the SPOC is reflected automatically in
the meeting log of every employee invited to that meeting. A MOM counts
as available once the SPOC has entered key discussion points or uploaded
a MOM document.

## 9.1 Viewing the MOM

Open the meeting from the Meeting log. The Minutes of meeting section
shows:

Key discussion points

Decisions taken

Follow-up requirements (when entered)

Next meeting date

MOM document: the uploaded file name, or "Entered in system" if the SPOC
typed the MOM directly

If the SPOC has not yet recorded the MOM, the section shows "Not yet
shared by SPOC" and "The MOM will appear here as soon as
`<organiser>`{=html} records it."

## 9.2 Downloading the MOM

Press Download MOM to save the minutes as a text file named
"`<MOM number>`{=html}\_MOM.txt". In the hosted version the browser asks
the employee to confirm the save. The file contains:

  -----------------------------------------------------------------------
  Section of file                     Content
  ----------------------------------- -----------------------------------
  Header                              MOM number, project code and name,
                                      meeting title, date, time, meeting
                                      type and category, mode and link /
                                      location, organiser, services.

  Attendance                          Each invited member: Attended / Not
                                      attended (with reason) / Not
                                      marked; additional participants.

  Key discussion points               As recorded.

  Decisions taken                     As recorded.

  Follow-up                           As recorded, plus next meeting
                                      date.

  Action items                        Numbered list: task \| owner
                                      (service) \| priority \| due date
                                      \| status.

  MOM document                        Name of the uploaded MOM document,
                                      if any.
  -----------------------------------------------------------------------

A sample downloaded MOM is reproduced in Appendix A.

## 9.3 Action items in the MOM

The action items listed in the MOM appear in the meeting's Action items
section, with the employee's own items highlighted. The employee can see
each due date and update the status of their own items there or in My
action items.

# 10. My action items

All action items assigned to the employee in MOMs, across all projects,
sorted by due date.

## 10.1 Filters

Open (default): Pending and In Progress.

Overdue: open items past their due date.

Completed.

All.

## 10.2 Columns and updates

  -----------------------------------------------------------------------
  Column                              Content / action
  ----------------------------------- -----------------------------------
  Action / task                       Task description and the SPOC's
                                      remarks.

  Project                             Project name.

  From meeting                        MOM number button (opens the
                                      meeting) and meeting title.

  Priority                            High (red), Medium (amber), Low
                                      (grey).

  Due date                            Target date. Red with "Nd overdue"
                                      when overdue; amber when due within
                                      3 days.

  Status                              Dropdown: Pending, In Progress,
                                      Completed. Changing it shows
                                      "Status set to `<status>`{=html}."
                                      and is visible to the SPOC
                                      immediately.

  Completed                           Completion date, set automatically
                                      to today when the status becomes
                                      Completed, and cleared if the item
                                      is reopened.

  Update note                         Free-text progress update for the
                                      SPOC. Saved when the employee
                                      leaves the field ("Update saved.").
                                      The SPOC sees it as "Update from
                                      `<name>`{=html}: ..." in their
                                      Action items tab.
  -----------------------------------------------------------------------

Figure 9. My action items

# 11. Statuses shown to the employee

## 11.1 Meeting status

  -----------------------------------------------------------------------
  Status                  Colour                  Meaning
  ----------------------- ----------------------- -----------------------
  Upcoming                Teal                    Scheduled, date today
                                                  or later.

  Rescheduled             Amber                   The SPOC moved the
                                                  meeting to a new date
                                                  (today or later).

  Awaiting update         Grey                    The date has passed but
                                                  the SPOC has not yet
                                                  marked the meeting
                                                  held, rescheduled or
                                                  cancelled it.

  Completed · MOM pending Amber                   Held; MOM not yet
                                                  recorded.

  Completed               Green                   Held and MOM recorded.

  Cancelled               Red                     Cancelled by the SPOC
                                                  (reason shown in the
                                                  details panel).
  -----------------------------------------------------------------------

## 11.2 Response status

  -----------------------------------------------------------------------
  Label                               Meaning
  ----------------------------------- -----------------------------------
  Response needed                     The employee has not yet responded
                                      to this scheduled meeting.

  You: available                      The employee responded Available.

  You: not available                  The employee responded Not
                                      available with a reason.
  -----------------------------------------------------------------------

## 11.3 Attendance status (own)

  -----------------------------------------------------------------------
  Label                               Meaning
  ----------------------------------- -----------------------------------
  Attended                            Marked attended by the SPOC.

  Absent / Not attended               Marked not attended by the SPOC,
                                      with the reason if entered.

  Not marked                          The meeting is held but attendance
                                      is not yet entered.
  -----------------------------------------------------------------------

# 12. Reminders and alerts for the employee

  -----------------------------------------------------------------------
  Reminder                            Where it appears
  ----------------------------------- -----------------------------------
  Today's meetings                    Today's meetings count and panel on
                                      the Overview, with the join link.

  Pending availability responses      "N awaiting" badge on the Meeting
                                      invitations tab, the Pending
                                      responses count, the Pending
                                      availability responses panel and
                                      the "Response needed" labels.

  Rescheduled or cancelled meetings   Rescheduled status with the new
                                      date; cancelled meetings move to
                                      the log with the reason.

  New MOM available                   MOM column shows Available in the
                                      Meeting log; Download MOM becomes
                                      available.

  Assigned action items               Open action items count, My action
                                      items panel on the Overview and the
                                      My action items tab.

  Action items due soon               Amber due date and amber dot (due
                                      within 3 days).

  Overdue action items                "N overdue" badge on My action
                                      items, red count on the Overview,
                                      red due date with days overdue.
  -----------------------------------------------------------------------

In the prototype these reminders are shown inside the dashboard. Email
or mobile notifications are listed as a production recommendation
(section 16).

# 13. End-to-end workflow

  -----------------------------------------------------------------------
  Step              Who               Where             What happens
  ----------------- ----------------- ----------------- -----------------
  1\. SPOC          SPOC              SPOC portal →     Meeting details,
  schedules meeting                   Schedule Meeting  link and
                                                        documents
                                                        entered.

  2\. Selects       SPOC              Schedule form     Team members
  required team                                         picked from the
  members                                               project team.

  3\. Meeting       System            Employee:         Invitation card
  appears in                          Overview, Meeting with "Response
  selected                            invitations       needed"; pending
  employees'                                            count and badge
  dashboards                                            increase.

  4\. Employee      Employee          Invitation card / Link (with Copy
  receives link and                   details panel     link), date,
  details                                               time, agenda,
                                                        organiser,
                                                        participants,
                                                        documents.

  5\. Employee      Employee          Your availability Response sent to
  selects Available                   box               the SPOC; status
  / Not available                                       label updates.

  6\. If Not        Employee          Your availability Reason from list;
  available →                         box               "Other --
  reason mandatory                                      specify" needs
                                                        text. Blocked
                                                        until given.

  7\. Meeting       SPOC              SPOC portal       SPOC marks the
  conducted                                             meeting held and
                                                        marks attendance.
                                                        Meeting moves to
                                                        the employee's
                                                        Meeting log.

  8\. SPOC prepares SPOC              SPOC portal → MOM Discussion,
  / uploads MOM                                         decisions,
                                                        follow-up,
                                                        document.

  9\. MOM reflected System            Employee: Meeting MOM shows
  in employees'                       log / details     Available;
  Meeting log                         panel             employee can view
                                                        and download it.

  10\. Employee     Employee          My action items / Own items
  views assigned                      details panel     highlighted with
  action items                                          due dates and
                                                        priority.

  11\. Employee     Employee          My action items   Pending → In
  updates                                               Progress →
  action-item                                           Completed, plus
  status                                                progress notes.
                                                        SPOC sees updates
                                                        immediately.
  -----------------------------------------------------------------------

# 14. Business rules

  -----------------------------------------------------------------------
  \#                                  Rule
  ----------------------------------- -----------------------------------
  E1                                  An employee sees only meetings for
                                      which the SPOC selected them as a
                                      team member.

  E2                                  Project SPOCs are not listed as
                                      employees of this dashboard.

  E3                                  A scheduled meeting appears as an
                                      invitation as soon as the SPOC
                                      saves it.

  E4                                  Availability is asked only for
                                      scheduled meetings that are
                                      upcoming and not cancelled.

  E5                                  A Not available response requires a
                                      reason from the list; Other --
                                      specify also requires a
                                      description.

  E6                                  A response can be changed until the
                                      meeting moves to the meeting log;
                                      the latest response and its date
                                      are kept.

  E7                                  A meeting moves to the log when it
                                      is marked held, cancelled, or its
                                      date has passed.

  E8                                  The MOM is visible once the SPOC
                                      has entered discussion points or
                                      uploaded a MOM document.

  E9                                  Employees can change the status
                                      only of action items assigned to
                                      them.

  E10                                 Completing an action item sets its
                                      completion date automatically;
                                      reopening clears it.

  E11                                 An action item is overdue when its
                                      due date has passed and it is not
                                      Completed; due soon within 3 days.
  -----------------------------------------------------------------------

# 15. Sample data in the prototype

The prototype includes four sample projects and these sample employees
(selectable under Viewing as):

  Employee         Designation                Service
  ---------------- -------------------------- ------------------
  Arjun Reddy      Structural Engineer        Structural
  Divya Prakash    Plumbing Designer          Plumbing
  Karthik Nair     Sr. Structural Engineer    Structural
  Kiran Thomas     Structural Draughtsman     Structural
  Lakshmi Iyer     Structural Design Lead     Structural
  Meera Shetty     Mechanical Designer        Mechanical
  Nikhil Joshi     MEP Coordinator            MEP Coordination
  Priya Menon      BIM Modeller               MEP Coordination
  Rohit Kulkarni   Electrical Engineer        Electrical
  Sanjay Rao       Clash Detection Engineer   MEP Coordination
  Suresh Babu      Fire Protection Engineer   Fire
  Varun Hegde      MEP Coordinator            MEP Coordination

Projects: DT-2419 Lakeside Residences Tower B (SMEPF), DT-2433 Northgate
Tech Park Ph-2 (MEP Coordination only), DT-2451 Greenfield Villas,
Hoskote (Structural only), DT-2460 City Care Hospital Annex (Structural,
Electrical, Fire). Sample meeting dates are set relative to the day the
dashboard is opened, so there is always a mix of today's, upcoming and
past meetings.

# 16. Prototype limitations and production recommendations

## 16.1 Current limitations

Data is sample data saved in the browser of the computer where it was
entered; it is not shared between users or computers.

The standalone Employee Meeting Dashboard page has its own data. To see
a SPOC's meeting arrive in an employee's dashboard in the prototype, use
the combined dashboard and switch from the SPOC portal to the Employee
portal.

Reference and MOM documents are shown by file name; the files themselves
are not stored. Download MOM produces a text summary.

Reminders are shown inside the dashboard only.

"Viewing as" is a demonstration control in place of a login.

## 16.2 Recommendations for the production build

Use employee login so each person sees only their own meetings and
action items.

Read meetings, responses, attendance, MOMs and action items from the
same shared database as the SPOC module.

Store reference documents and MOM files in the document management
system and let employees open the original file.

Send invitations, responses-due reminders, MOM-published notices and
action-item due / overdue reminders by email or app notification, with
calendar invites carrying the meeting link.

Notify the SPOC when an employee responds Not available or updates an
action item.

Keep an audit trail of responses and action-item updates.

# Appendix A. Sample downloaded MOM

Example of the file produced by Download MOM for meeting MOM-2460-002,
as seen by Rohit Kulkarni:

MINUTES OF MEETING

MOM no.: MOM-2460-002

Project: DT-2460 -- City Care Hospital Annex

Meeting: DRM: pile tests and substation location

Date: 17 Sep 2026

Time: 10:30 AM--11:45 AM

Meeting type: Client / DRM (Scheduled)

Mode: Online -- https://meet.google.com/

Organised by (SPOC): Sneha Gowda

Services: Structural, Electrical, Fire

ATTENDANCE

-   Sneha Gowda: Attended

-   Arjun Reddy: Not attended (Pile load test witness at site)

-   Rohit Kulkarni: Attended

-   Suresh Babu: Not attended

KEY DISCUSSION POINTS

Pile test results within limits. Substation moved to north-east corner
to keep fire tender path clear.

DECISIONS TAKEN

Substation relocation approved.

FOLLOW-UP

---

ACTION ITEMS

1.  Revise substation cable route and LT panel layout \| Rohit Kulkarni
    (Electrical) \| Medium \| Due 13 Oct 2026 \| In Progress

MOM document on file: MOM_DRM_02.pdf

------------------------------------------------------------------------

# Consolidated Implementation Checklist

## A. Identity and access

-   [ ] Implement authenticated users instead of demo "Viewing as"
    selectors / quick-login access.
-   [ ] Enforce role-based navigation and second-level route/page
    authorization.
-   [ ] Enforce project/service scope described by the source role
    policy.
-   [ ] Keep Client and Architect restricted to Project Portal.
-   [ ] Keep Admin-only Transmittal management restricted to Admin.
-   [ ] Preserve role-specific tabs and approval visibility.

## B. Core project delivery

-   [ ] Projects dashboard.
-   [ ] Project detail.
-   [ ] New Project.
-   [ ] Project team and allocation.
-   [ ] Work progress.
-   [ ] Deliverables.
-   [ ] Revision log.
-   [ ] Drawing register.
-   [ ] Awaiting-response tracking.
-   [ ] GFC drawing tracking.
-   [ ] Transmittal tracking.
-   [ ] Notifications.

## C. Work and man-hours

-   [ ] Daily work update.
-   [ ] Project/stage/deliverable/task linkage.
-   [ ] Hours tracking.
-   [ ] Other-project hours.
-   [ ] Holiday/Sunday/extra-hours handling where documented.
-   [ ] Role-specific work-entry location.
-   [ ] Mandatory daily man-hour validation before sign-out.

## D. Meetings

-   [ ] Scheduled meetings.
-   [ ] Sudden/ad-hoc meetings.
-   [ ] Service-based responsible-person assignment.
-   [ ] Project-team participant selection.
-   [ ] Employee invitations.
-   [ ] Available / Not Available response.
-   [ ] Mandatory unavailability reasons.
-   [ ] Attendance.
-   [ ] MOM.
-   [ ] MOM document/reference handling.
-   [ ] Action items.
-   [ ] Employee action-item status and progress notes.
-   [ ] Dashboard alerts/reminders.
-   [ ] Absence log.
-   [ ] Project meeting history.
-   [ ] Employee Meeting Dashboard.

## E. Productionisation

The source documents explicitly identify prototype limitations such as
browser-local sample data, demo login/person switching, and
file-name-only document recording in the meeting prototypes. These must
be replaced by shared authenticated server-side persistence and real
file/document handling for production.

The exact production architecture is intentionally not invented in this
file; implementation should follow the project's separately approved
technical architecture while preserving the functional requirements
above.
