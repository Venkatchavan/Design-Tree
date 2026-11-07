// DT Peer Review access (07 Nov 2026 requirement, slide 2):
//  - ADMIN (Arpitha D, Sandeep N) allots a project to the review team.
//  - The review team (Veeshal Rathod V, T Anusha Chowdary, Mallappa S Maranur)
//    works the allotted packages; nobody types review-team names any more.
//  - The peer review log is viewed by Srinivasa Rao and the Founding Directors,
//    read-only. No other director has access to it.
// Emails are matched case-insensitively against the login; employee ids are the
// BLR roster ids of the people the admin may allot.
export const DT_PR_ALLOTTER_EMAILS = ['arpithad@designtreeconsultants.com', 'sandeepn@designtreeconsultants.com'];
export const DT_PR_VIEWER_EMAILS = ['srinivasarao@designtreeconsultants.com'];
export const DT_PR_REVIEWER_EMP_IDS = ['DT-25-1690', 'DT-26-1859', 'DT-26-1850'];
