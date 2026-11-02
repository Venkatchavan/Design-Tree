# SPOC picker follow up 27 October 2026

The marked project activation dropdown previously loaded the whole employee directory. It did not filter by the coordinator login role. Activation checked that the Employee existed but did not verify that the employee had an active SPOC login.

The picker now reads GET `/api/employees/spoc-options`. Eligible records have an active `coordinator` User linked through User.employee to an Employee who has not exited. A conflicting reverse link or multiple active coordinator logins sharing one employee excludes that identity for HR review. On Leave does not itself mean Exited. Name or designation alone does not grant SPOC eligibility.

The endpoint returns only name, employee ID and the employee key needed for selection; it does not return email, passwords or login hashes. All eligible SPOCs are returned without a 200-record cap. Admin/Billing, TD and HR can read this list through the existing role guard. Other internal roles cannot read this endpoint. Existing Super Role handling in requireRole is unchanged.

The marked TD picker displays only eligible options, with loading, retry and empty states. It refreshes every ten seconds and on the usual query focus behavior. Activation stays disabled until a valid option is selected. Coordinator logins that cannot be selected are listed separately under HR review with the reason: inactive login, missing employee link, exited employee, conflicting links or multiple active SPOC logins for one employee.

POST `/api/projects/:id/activate` rechecks the same eligibility before changing the project or creating an approved allocation. An empty initial selection or a forged/stale non-SPOC selection is rejected. A valid existing activation SPOC can still be used for an idempotent reactivation if it remains eligible. The valid activation flow still approves the allocation and opens assigned SPOC workspace access. Stage and billing approval policy is unchanged.

Some names visible to Super User should not appear in this picker: non-SPOC employees and inactive/exited or incorrectly linked coordinator records. The BLR reference login list has no `coordinator` role entries; those reference roles are not automatically promoted. HR must verify actual role assignments and link the existing login to the correct existing employee. No employee is created, merged, relinked or promoted by this picker. Users whose role is corrected should sign in again to receive their current role session.

The client's database and exact missing-name set were unavailable. The local fix and diagnostics do not establish which company records need correction. Deploy this code, review the excluded SPOC logins in the dropdown panel, correct verified identities through the authorized account workflow and confirm the reported names with the client.

Validation uses disposable local MongoDB and the production frontend bundle. Tests cover more than 200 eligible users, excluded non-coordinator/inactive/exited/conflicting/ambiguous records, authorization, live role changes, stale submit rejection, visible lookup errors and retry, an empty list and successful project activation with SPOC workspace access. Earlier client workflows are regression checked separately. Company deployment and acceptance remain pending.
