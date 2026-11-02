# SPOC contact reflection fix 26 October 2026

A reported screenshot shows blank PMC and Peer Review fields after contact entry. The affected company record and deployed commit have not been inspected.

A local browser reproduction identified a two-step save gap: ContactPicker's Save contact created a shared directory record and updated the form selection, while the project snapshot was saved only by a separate Save contacts action. Existing tests selected pre-created contacts and explicitly clicked that second action, so they did not cover the reported new-contact path.

The SPOC form now links a selected or newly created contact to the project immediately. It submits only the changed contact field, updates the project query cache from the successful response, and refreshes the project record. Failed project-link saves display an error and retain the draft for Save contacts to retry without creating the directory contact again. Changing a picker alone does not erase the saved project contact until the user saves the change.

Project details display name, company, designation, email and phone. The picker handles both company and organization labels. Open project details refresh every ten seconds so permitted viewers see saved changes even if realtime notifications are unavailable.

The existing project-contact API, SPOC project-scope checks, other contact groups, approvals and holds are unchanged. There is no automatic migration of directory contacts to projects; existing directory records must be selected for the correct project if they were never linked.

Local acceptance covers creating PMC and Peer Review contacts without a second Save contacts click, persistence after reload, reflection in another open login, selecting existing contacts while preserving the other field, and a failed-save retry. The company case still requires deployment and acceptance against its actual data.
