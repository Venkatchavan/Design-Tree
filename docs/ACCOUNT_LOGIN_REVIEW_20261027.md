# Account availability and login follow up 27 October 2026

The supplied BLR workbook is identical to the workbook in bfa2a0f. The client says some employees already exist in the Super User list, new-joiner emails are unavailable and other branch details will follow. This change preserves existing identities and makes those cases reviewable without automatically importing the workbook.

The nine sheets contain 462 nonempty rows, including 157 rows without an email. There are 296 distinct email values, while the reference login list contains 286. ADMIN rows 6 and 10 each contain two email values; the audit flags those rows for review rather than silently selecting one address. The ten email values outside the reference list are not automatically classified as missing company accounts.

## Account audit and duplicate protection

`api/src/scripts/audit-blr-users.js` reads every nonempty row in every workbook sheet and all User/Employee records, without a 200-record query limit. It classifies existing logins, employee-only records, missing logins, missing emails, duplicate roster entries and ambiguous identities. Email comparison ignores case and surrounding whitespace; name comparison also normalizes punctuation and spacing. Name matches alone require review and never trigger an automatic merge.

The report includes normalized duplicate email counts and broken employee/login links. Password hashes are excluded. If `--out` is supplied, the file is created privately and an existing report is not overwritten. The script issues only database reads, requires an explicit MONGO_URI and does not create indexes or provision accounts.

Example from the API directory on a configured server:

```sh
node src/scripts/audit-blr-users.js --file /tmp/blr-employee-details.xlsx --out /tmp/blr-account-audit.json
```

For the existing Docker deployment, copy the workbook to `/tmp/blr-employee-details.xlsx` in `designtree-api`, run the command with `docker compose exec -T api node ...`, then copy the private report back for review. Rebuild/recreate the API image first so the new modules are present. This review did not connect to the company database or execute these server commands.

`add-blr-users.js` now defaults to a read-only audit. Creation requires `--apply` and BLR_INITIAL_PASSWORD supplied through the environment; there is no source-defined default password. The reference list retains the 286 supplied role assignments. Existing passwords, roles, activation and links are preserved. Employee-only records, missing emails and ambiguous name/email matches are held for review. The importer rechecks before each candidate and compensates both records if its reverse-link save fails. It uses the existing User email and Employee ID unique constraints; a failed attempt is reported rather than silently retried. Apply is intended for one reviewed batch at a time. Conflicting or partial pre-existing records require reconciliation by the account administrator.

The PowerShell launcher audits by default; `-Apply` explicitly opts into creation. It uses the rebuilt API image instead of copying a lone script that would lack its new dependencies. No production import, account activation, password reset or identity merge was performed.

## Complete directories

GET `/api/users` and `/api/employees` accept page/limit, retain existing filters and authorization, and return total/page/limit/hasMore. Each page is bounded at 200 rows with a stable createdAt and ID sort. Default browser directory calls collect all pages and deduplicate IDs; explicit page/limit requests still return a single page. This removes the former silent omission of records after the first 200. It does not establish which accounts are actually present in production.

## Reported login failure

The screenshot shows a browser-level “Failed to fetch” message. The browser request helper now labels transport failures as connection failures and permits the user to retry. It does not retry login automatically or replace HTTP authentication errors. The same-origin API default and certificate validation remain intact.

A read-only check from the development workstation on 27 October found that the documented public HTTP health address redirects to HTTPS, and HTTPS fails certificate validation because the certificate does not match the documented IP address. The client's exact URL and server/database access were unavailable. This is evidence about the documented address, not confirmation of the screenshot's root cause. LAN health was unreachable from this workstation.

On the client network, confirm the actual app URL and the failing request in browser Network tools, then check that `<actual app origin>/api/health` returns JSON with `ok: true` using a valid certificate. Confirm the frontend calls that origin's `/api`, that the intended gateway owns the forwarded listener, and that the API is healthy. Correct the served certificate or use its approved matching hostname. Do not bypass certificate validation or reset user passwords to address a transport error.

## Validation and limits

Before changes, targeted tests reproduced the truncated directories, raw network message and write-by-default importer. The account tests cover bounded pagination, full filtered retrieval, authorization, no login retry, read-only defaults, normalized duplicate identity detection, missing-email deferral, repeat imports, credential preservation, rollback and workbook audit reads. Existing API and browser regression results are retained in the local review evidence. Disposable fixtures do not establish company account completeness or production acceptance. New joiner emails and future branch rosters remain pending.
