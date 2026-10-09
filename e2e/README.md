# DesignTree e2e — Project Initiation & Execution Workflow

Playwright UI + API suite for `Project_Initiation_and_Execution_Workflow.md`:

`Admin → Design Management Head → SPOC → Project Execution → GFC Submission`

## Target (per user choice)

- `web` → http://localhost:5173 (vite dev, `/api` proxied to :5000)
- `api` → http://localhost:5000
- mongo → local isolated DB `designtree-e2e` (never production)

## Install

This folder lives at repo root `e2e/` after the elevated copy step below.

```powershell
cd e2e
Copy-Item .env.example .env   # then set E2E_FD_PASSWORD to api SEED_PASSWORD
npm install
npx playwright install chromium
```

## Run order (serial, workers:1)

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

Seed once before the first run (FD only, empty DB):

```powershell
cd ../api
npm run seed
```

Specs map to the workflow doc:

| Spec | Workflow | Scorecard |
|---|---|---|
| 01-cast-creation | §1 HR Add employee x11 | #1-#2 |
| 02-admin-create-project | §2 New project DT-2601 | #3 |
| 03-design-head-review | §3 DMH tabs | #4 |
| 04-team-finalisation | §4 3 teams (API, F-01) + Save members | #5 |
| 05-spoc-allocation | §5 Record allocation → activation | #6 |
| 06-directory-access | §6 directory + portal isolation | #7 |
| 07-spoc-workflow | §7 meetings/MOM/actions/coord/RFI/revision | #8-#16 |
| 08-execution | §8 engineers/TL/QS/QA/BIM | #17-#20 |
| 09-approval-gfc | §9 approval/transmittal/billing/cert/portal/leave/support + GFC | #21-#28 |

## Notes

- Cookie-JWT auth: UI uses `#loginEmail` / `#loginPassword` / `.login-btn`; API uses `POST /api/auth/login`.
- Sign-out between every role (§0.3). Engineer/Drafter + Coordinator man-hour gate is handled in `helpers/auth-ui.ts`.
- Teams have no Create UI (F-01): `helpers/api.ts` does `POST /api/teams` as Admin, UI verifies cards.
- Judging rule (§0.6): each step asserts the literal toast / row / KPI text.
- Findings log: append to `Project_Initiation_and_Execution_Workflow.md` Appendix F (F-01 already recorded).

## Useful

```powershell
npm run list        # list all tests without running
npm run test:headed # watch the browser
npm run report      # open last HTML report
```
