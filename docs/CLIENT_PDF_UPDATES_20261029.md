# Employee feedback - 29 October 2026

Base: `fac386d`, branch `dev/vishwa`. Reviewed all six pages and seven embedded images.

## Requested, repeated and delivered

| Pages | Request | Comparison with earlier requirements | Result |
| --- | --- | --- | --- |
| 1, 3 | Consolidate Teams and My Team | The PDF repeats this issue. It revises the 27 October instruction to provide a separate company Teams directory. The user confirmed TD and ATD only. | One My Team navigation entry for TD/ATD. Legacy `/teams` links redirect there. AD/HR retain their directories. Existing company-directory API read rights are unchanged. |
| 1 | Give ATD the working My Team tabs shown in the TL reference | ATD previously had a personal directory and Assign work only; this is an additional workspace request. | ATD uses Overview, Project & team, Team work monitoring, Assign work, Deliverables, Awaiting response, Revision and Drawing register. Existing recruitment and personal People access remain. Revision entry/log remain separate. Saved director/team relationships bound the roster and work-entry monitoring/decisions. |
| 2 | Show only the TL's service team | Earlier roster loading restored project members but included other disciplines on the same project. | Both task options and create/update validation now derive allowed services from the TL's saved active lead allocations on that project. Service aliases/bundles use the existing normalizer. Valid saved sibling rosters in the same service remain available, including when the TL's own team has no members. No department-wide or company-wide fallback is used. |
| 2 | Apply the employee list reportedly shared on WhatsApp | Repeats the pending approved-roster request from 27/28 October. | Pending the actual approved employee/project/service/TL mapping and authorized company access. No screenshot names are created or assigned. |
| 4 | DMH SPOC dashboard under My Team | The existing Design Management workflow is not the new supplied prototype. | Pending the explanation document to define relocation, reporting scope, project allocation actions and metric rules while preserving existing workflow access. |
| 5 | SPOC daily work/man-hour register | Existing saved SPOC work areas/hours are available; the aggregate DMH register shown is new. | Pending the explanation document for grouping, working-day window, hour thresholds and treatment of missing entries. Sample names, hours and counts in the prototype are not production data. |
| 6 | Selected-SPOC detail and subcategories | Extends earlier team/project visibility; the page explicitly refers to the Word explanation. | Pending the document defining tabs, subcategories, workload/pending metrics, remarks and authority. No invented scores or reporting relationships. |

## Verification

- Eight focused API cases pass after reproducing seven failures on the baseline.
- Broad native command: 91 passing tests; one Docker-only spreadsheet test cannot initialize outside its container (`/app/xlsx`).
- Nine new production-bundle browser checks pass, including ATD tabs, roster scope, legacy links, mobile layout and retained AD/HR views.
- Thirteen prior-release HR/travel/leadership browser checks pass.
- Web production build passes. Changed-file ESLint errors decrease from five to four; nine existing warnings remain, with no introduced findings.
- The original `npm test` Playwright command still fails before initialization because `/tmp/designtree-local-fixture.json` is absent. Dedicated browser runners use a separate disposable fixture.

No company database or production deployment was accessed or changed. Deploy the delivered commit and verify real records separately. The detailed DMH/SPOC request remains open for the explanation document.
