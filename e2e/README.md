# DesignTree e2e — delivery flow suite

Playwright UI + API suite for the delivery flow:

`Admin → Design Management Head → SPOC → Project Execution → GFC Submission`

Specs live in `specs/01-09` and run **serially** (`workers: 1`,
`fullyParallel: false`) — every role signs in and signs out in order, so
parallel workers would break session isolation.

## Target (local dev only, never production)

- `web` → http://localhost:5173 (vite dev, `/api` + `/socket.io` proxied to :5000)
- `api` → http://localhost:5000 (with `MONGO_URI` pointed at the e2e DB)
- mongo → local isolated DB `designtree-e2e` (never the production `designtree` DB)

## Install

```powershell
cd e2e
Copy-Item .env.example .env   # then set E2E_SU_PASSWORD to the api SEED_PASSWORD
npm install
npx playwright install chromium
```

### Environment (`e2e/.env`)

| Name | Default | What it is |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:5173` | Web under test |
| `E2E_API_URL` | `http://localhost:5000` | API under test (also in `metadata.apiUrl`) |
| `E2E_MONGO_URI` | `mongodb://127.0.0.1:27017/designtree-e2e` | Isolated DB the api must be started with |
| `E2E_SU_EMAIL` | `superuser@designtree.com` | Superuser seed email (must match api `SEED_EMAIL`) |
| `E2E_SU_PASSWORD` | *(required, no default)* | Superuser seed password (**must equal** api `SEED_PASSWORD`; used by `specs/01`) |
| `E2E_TEST_PASSWORD` | `Test@1234` | Shared password for the 11 cast logins created by `specs/01` |

`playwright.config.ts` loads `e2e/.env` first, then falls back to repo-root
`.env` for any missing value.

## Run order (serial)

```powershell
# terminal 1 — api (isolated DB)
cd ../api
$env:MONGO_URI="mongodb://127.0.0.1:27017/designtree-e2e"
npm run dev

# terminal 2 — web
cd ../web
npm run dev

# terminal 3 — e2e
cd ../e2e
npm run test
```

Seed once before the first run (superuser only, empty DB):

```powershell
cd ../api
npm run seed
```

`specs/01` skips itself with `Set E2E_SU_PASSWORD to the api SEED_PASSWORD`
if the superuser password is not provided — set it, don't bypass the skip.

## What the specs cover

| Spec | Area | Scorecard (`fixtures/scorecard.ts`) |
|---|---|---|
| 01-cast-creation | HR `Add employee` ×11 (cast in `fixtures/roles.ts`), employee-profile check | #1–#2 |
| 02-admin-create-project | Admin creates project `DT-2601` (`fixtures/project.ts`) | #3 |
| 03-design-head-review | Design Management Head tab review | #4 |
| 04-team-finalisation | 3 teams via `POST /api/teams` (no Create-team UI) + `Save members` check | #5 |
| 05-spoc-allocation | `Record allocation` → project activation | #6 |
| 06-directory-access | Directory + `client`/`architect` portal isolation (portal sees only `DT-2601`) | #7 |
| 07-spoc-workflow | Schedule/sudden meetings, held + attendance + MOM, action items, coordination/RFI/revision logs | #8–#16 |
| 08-execution | Engineer availability responses, TL acknowledge/start/submit, QS/QA/BIM entries | #17–#20 |
| 09-approval-gfc | Revision approval, transmittal sent→acknowledged, billing + `Mark billed`, certificate, portal acknowledge, leave approve, support ticket, GFC close | #21–#28 |

Judging rule: each step asserts the literal toast / row / KPI text (see
`helpers/asserts.ts`).

## Helpers

- `helpers/auth-ui.ts` — `signIn` (`#loginEmail` / `#loginPassword` /
  sign-in button, plus best-effort 09:45 late-sign-in reason modal),
  `signOut` (man-hour gate → `Take me to entry` + minimal hours, then
  attendance late/early reason gate), `gotoNav`, `selectOptionContaining`.
- `helpers/api.ts` — `apiLogin`/`apiLogout` (`POST /api/auth/login`),
  idempotent `ensureProjectViaApi` (`DT-2601`), `ensureTeamsViaApi`
  (Structural/Mechanical/MEP Coordination), `getEmployeeIdMap`,
  `recordSpocAllocation`.
- `helpers/asserts.ts` — `expectToast` / `expectTableRow` / `expectText`,
  `fillTomorrowDate` / `fillDatePlusDays`.
- `fixtures/roles.ts` — 11-person cast (admin, DMH, TL-struct, SPOC, 2×
  engineer, QS, QA, BIM, client, architect) + `SUPERUSER` / `TEST_PASSWORD`.
- `fixtures/project.ts` — `DT-2601` payload, SPOC services, meeting/MOM/
  action/coordination/RFI/revision/billing/leave/support values.
- `fixtures/scorecard.ts` — 28-row completeness checklist, each row mapped
  to its spec file.

## Useful

```powershell
npm run list        # list all tests without running
npm run test:headed # watch the browser
npm run test:ui     # interactive UI mode
npm run report      # open last HTML report
```
