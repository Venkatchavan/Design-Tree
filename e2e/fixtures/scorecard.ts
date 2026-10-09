/** §11 completeness scorecard: 28 rows mapped to spec files. */

export interface ScoreRow {
  id: number;
  control: string;
  expected: string;
  spec: string;
}

export const SCORECARD: ScoreRow[] = [
  { id: 1, control: 'HR Add employee x11', expected: '11 rows; all sign in', spec: '01-cast-creation' },
  { id: 2, control: 'Row click Employee profile', expected: 'All fields + Linked login shown', spec: '01-cast-creation' },
  { id: 3, control: 'Dashboard New project + Save', expected: 'Detail opens; Active +1', spec: '02-admin-create-project' },
  { id: 4, control: 'DM tabs', expected: 'Scope/fees match §2, no errors', spec: '03-design-head-review' },
  { id: 5, control: 'Teams (API create) + Save members', expected: '3 cards, counts correct', spec: '04-team-finalisation' },
  { id: 6, control: 'Directory Record allocation', expected: 'Overview 1 allocated project(s)', spec: '05-spoc-allocation' },
  { id: 7, control: 'Portal (client/architect)', expected: 'Only DT-2601 visible', spec: '06-directory-access' },
  { id: 8, control: '+ Schedule Meeting', expected: 'Toast Meeting scheduled. Invitations sent to ...', spec: '07-spoc-workflow' },
  { id: 9, control: '+ Add Sudden Meeting', expected: 'Toast + held panel, reason stored', spec: '07-spoc-workflow' },
  { id: 10, control: 'Mark meeting held', expected: 'Attendance/MOM unlock', spec: '07-spoc-workflow' },
  { id: 11, control: 'Not attended + reason + Save attendance', expected: 'Count + Absence log row', spec: '07-spoc-workflow' },
  { id: 12, control: 'MOM Save MOM', expected: 'Clears Completed - MOM pending', spec: '07-spoc-workflow' },
  { id: 13, control: 'Add action item x2', expected: 'Tab badge = 2; assignees see them', spec: '07-spoc-workflow' },
  { id: 14, control: 'Coordination log save', expected: 'Row on Coordination tab', spec: '07-spoc-workflow' },
  { id: 15, control: 'RFI save', expected: 'Row with due + status', spec: '07-spoc-workflow' },
  { id: 16, control: 'Revision log save', expected: 'Row by service', spec: '07-spoc-workflow' },
  { id: 17, control: 'Available / Not available + Send response', expected: 'SPOC sees both + reason + note', spec: '08-execution' },
  { id: 18, control: "Submit for team lead action", expected: 'TL queue shows entry', spec: '08-execution' },
  { id: 19, control: 'Task Acknowledge/Start/Submit', expected: 'Status pills change', spec: '08-execution' },
  { id: 20, control: 'QS/QA/QC/BIM log entries', expected: 'Each Work Tracking lists its row', spec: '08-execution' },
  { id: 21, control: 'Revision → Approved', expected: 'Queues clear', spec: '09-approval-gfc' },
  { id: 22, control: 'Transmittal Sent→Acknowledged', expected: 'Company log rows', spec: '09-approval-gfc' },
  { id: 23, control: 'Submit billing entry + Mark billed', expected: 'Totals + readiness update', spec: '09-approval-gfc' },
  { id: 24, control: 'Certificate issued', expected: 'Listed', spec: '09-approval-gfc' },
  { id: 25, control: 'Confirm received + request response', expected: 'SPOC sees both', spec: '09-approval-gfc' },
  { id: 26, control: 'Submit leave + Approve', expected: 'Approved + bell for Meera', spec: '09-approval-gfc' },
  { id: 27, control: 'Queries + Submit', expected: 'Queue shows ticket', spec: '09-approval-gfc' },
  { id: 28, control: 'GFC set + closing MOM', expected: 'History complete, certificate issued', spec: '09-approval-gfc' },
];
