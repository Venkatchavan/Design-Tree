# Salesforce dev org fixture — `Project__c`

Everything needed to stand up a matching `Project__c` schema in a **free Salesforce
Developer Edition org**, so the DesignTree connector can be built and tested without
touching the client's org or asking anyone for credentials.

This is a development fixture. It is not deployed to the client's org.

## What it creates

| Item | Detail |
|---|---|
| Object | `Project__c` — created once by hand in Setup (see prerequisites) |
| Fields | 13 custom fields, matching the client's manual and layout screenshots |
| Permission set | `DesignTree_Salesforce_Dev` — grants field-level security for the 13 fields |
| Records | 3 synthetic records — a WO project, a proposal, and an edge case |

The package deliberately does **not** redeclare `Project__c`. It only adds fields,
which makes it safe to re-run against an org where the object already exists.

The permission set is not optional. Fields created through the Metadata or Tooling
API are not added to any profile, so without it the fields exist but SOQL returns
`No such column` for every one of them.

## Prerequisites

1. A Developer Edition org: <https://developer.salesforce.com/signup>
   (personal email is fine; "Company" is free text).
2. The `Project__c` object already exists:
   **Setup → Object Manager → Create → Custom Object**
   - Label `Project`, Plural Label `Projects`, Object Name `Project`
   - Record Name `Project Name`, Data Type `Text`
3. Salesforce CLI:

```powershell
npm install --global @salesforce/cli
sf org login web --alias dt-dev --set-default
```

## Deploy

```powershell
.\salesforce\deploy.ps1
```

If PowerShell blocks scripts:

```powershell
powershell -ExecutionPolicy Bypass -File .\salesforce\deploy.ps1
```

The script runs four steps and stops on the first failure:

1. `sf project deploy start --manifest metadata/package.xml`
2. `sf org assign permset --name DesignTree_Salesforce_Dev` — field-level security
3. `sf data import tree --files data/Project__c.json`
4. `sf sobject describe --sobject Project__c --json > project-describe.json`

Options: `-TargetOrg <alias>` (default `dt-dev`), `-SkipData` (fields only).

## Fields

| Field | API name | Type | Notes |
|---|---|---|---|
| Project Code | `Project_Code__c` | Text(32) | Unique |
| Job Numbers | `Job_Numbers__c` | Text(64) | |
| Used For | `Used_For__c` | Picklist | `Proposal`, `WO`; unrestricted |
| Entity Name | `Entity_Name__c` | Text(255) | |
| Customer Group | `Customer_Group__c` | Text(255) | |
| State | `State__c` | Text(64) | |
| Project Type | `Project_Type__c` | Text(64) | |
| Branch Name | `Branch_Name__c` | Text(64) | |
| Location | `Location__c` | Text(255) | |
| Service Names | `Service_Names__c` | Text(255) | |
| Contact Person Name | `Contact_Person_Name__c` | Text(255) | |
| Project Director | `Project_Director__c` | Text(255) | |
| Has Work Order | `Has_Work_Order__c` | Checkbox | Defaults to false |

Text fields stand in for the lookups the real org uses (`Entity_Name__r.Name`,
`Customer_Group__r.Name`). When the client supplies a `DESCRIBE` or sample SOQL
output, the normalizer switches from `__c` to `__r.Name` and the fixture is updated.

`Used_For__c` is intentionally **unrestricted**, so a junk value can be typed to
exercise the warning path. A restricted picklist would block the test before the
app ever sees it.

## Test records

Names are synthetic on purpose. Do not load client data into a free org without
permission; the shapes (codes, branches, services) mirror the client's manual.

| Record | Code | Why it exists |
|---|---|---|
| 10 Acre Plotted Development & Buildings | `PRJ-00428` | WO project: job number, known branch, `STR, PHE, ELE` |
| Corporate Office Fitout - Proposal Stage | `PRJ-00427` | Proposal, no job number, `Has Work Order = false` |
| Edge Case - Unknown Branch and Service | `PRJ-00429` | Blank Entity, `Architecture` service, `DT-Unknown` branch |

For the import to resolve branches, add `DT-Bengaluru` and `DT-Telangana` as
active branches in DesignTree (Branches page). Do **not** add `DT-Unknown` — it
is the fixture for the warning path.

## Viewing records

New custom objects have no tab. Either open
`/lightning/o/Project__c/list` directly, or add a tab in three clicks:
**Setup → Tabs → Custom Object Tabs → New → Object `Project` → Save**.

## Changing the API version

`sfdx-project.json` → `sourceApiVersion` and `metadata/package.xml` → `<version>`
must match. To see what the org supports:

```powershell
sf org display --target-org dt-dev --json
```

## External Client App (OAuth)

Newer orgs no longer offer **New Connected App** in App Manager; Salesforce
replaced it with **External Client App**. The OAuth endpoints are identical, so
the integration code is unaffected.

1. Setup → Quick Find `External Client App Manager` → **New External Client App**.
2. Name `DesignTree Integration Dev`, your contact email, Distribution State **Local**.
3. Expand **API (Enable OAuth Settings)**:
   - Enable OAuth
   - Callback URL `http://localhost:5000/api/integrations/salesforce/oauth/callback`
   - Scopes `api` and `refresh_token`
   - **Flow Enablement** → check **Enable Client Credentials Flow**
4. **Create**, then copy the Consumer Key and Consumer Secret.
5. Open the app → **Policies** tab:
   - Permitted Users: **Admin approved users are pre-authorized**
   - Selected Profiles: `System Administrator`
   - **OAuth Flows and External Client App Enhancements** → enable Client
     Credentials Flow → **Run As** = your username
   - Save.
6. Wait 2–10 minutes before the first token request.

`Run As` is mandatory. Without it the token endpoint returns
`invalid_grant: no user is configured`; without the profile assignment it
returns `invalid_client`.

## After the deploy

Add the External Client App values to `api/.env` (git-ignored, never commit):

```env
# Use this org's My Domain URL. Plain https://login.salesforce.com returns
# invalid_grant "request not supported on this domain" for Developer Edition.
SF_LOGIN_URL=https://your-domain.my.salesforce.com
SF_CLIENT_ID=your-consumer-key
SF_CLIENT_SECRET=your-consumer-secret
SF_API_VERSION=68.0
SF_PROJECT_OBJECT=Project__c
```

## DesignTree integration

The connector is read-only. It authenticates with the client-credentials flow,
searches `Project__c`, and prefills the Admin → New Project form. Importing a
record stores its Salesforce id on the project; nothing is written back and no
scheduled sync runs.

| Endpoint | Who | Purpose |
|---|---|---|
| `GET /api/integrations/salesforce/status` | Admin/Billing | Reports whether the server is configured |
| `GET /api/integrations/salesforce/projects?q=…&includeProposals=1` | Admin/Billing | Search work orders (default) or all records |
| `GET /api/integrations/salesforce/projects/:id` | Admin/Billing | Fetch and normalise one record |

Field mapping:

| Salesforce | DesignTree |
|---|---|
| `Project_Code__c` | `code` |
| `Job_Numbers__c` | `jobNumber` |
| `Entity_Name__c` | `entityName` |
| `Customer_Group__c` | `clientName` and client contact company |
| `Project_Director__c` | `related.projectDirector` |
| `Service_Names__c` | `services` via alias mapping |
| `Branch_Name__c` | active branch name, or a warning |
| `Used_For__c` | `usedFor` |
| `State__c` / `Location__c` / `Project_Type__c` | matching form fields |

Unknown branches and services are reported as warnings and left blank/omitted.
The unique sparse `salesforceRecordId` index prevents the same Salesforce record
being imported twice; a duplicate returns `409` with the existing project.

Then run the token + SOQL check from the setup notes. `project-describe.json` is
safe to share — it is schema only, no records and no credentials. The consumer
secret and access tokens are not.
