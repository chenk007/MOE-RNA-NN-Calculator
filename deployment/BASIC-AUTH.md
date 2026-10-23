# Reviewer access on the existing Worker

This repository uses the existing `moe-rna-nn-calculator` Worker and its native main-branch Git integration. No Zero Trust subscription or paid plan is required. Authentication requests consume Workers Free request quota; exhaustion should fail rather than bypass authentication.

## Runtime configuration

In Workers & Pages > moe-rna-nn-calculator > Settings > Variables and Secrets:

- Add **Secret** `BASIC_AUTH_USERNAME` and **Secret** `BASIC_AUTH_PASSWORD` with your reviewer credentials. Values are deliberately absent from source and tests.
- Add text variable `REQUIRE_AUTH` with value `true`.
- Deploy the settings change.

Only the exact text `false` enables public access. Missing or invalid values require authentication. Missing secrets return 503 without serving files. `keep_vars: true` preserves dashboard variables across Git deployments; REQUIRE_AUTH is deliberately not declared under Wrangler vars.

After publication, edit REQUIRE_AUTH to `false` in the dashboard and deploy that settings change; no source edit is needed. To restore reviewer access, change it to `true` and deploy. Do not test public mode against unpublished production data; validate it with a placeholder-only local/isolated environment first.

## Routing and deployment

`npx wrangler deploy` runs the configured build, tests the gate, and copies only six unchanged website files into public/. `assets.run_worker_first: true` forces every request through the Worker, including existing assets and index redirects. The internal ASSETS binding has no separate public hostname. Worker source, tests, documents and configuration are excluded from static publishing. Responses use no-store to prevent shared/client cache reuse of protected data.

Preview URLs are disabled by configuration. Inspect Domains after deployment to confirm the setting, and test known historical version URLs. Never roll back to an old static-only version: it has no gate. Keep the duplicate Worker until verification; afterward disable its production and preview URLs and automatic builds, or deploy the same gate there with its own secrets and explicit Worker name. Audit custom domains too.

## Verification

Check every deployed path with no credentials (401 + WWW-Authenticate), wrong credentials (401), and correct credentials (expected HTML/asset response). Follow index normalization only after checking the original request is challenged anonymously. Compare authenticated asset bytes to the source commit. Exercise dilute/PEG and single/batch calculations, PS controls, language switching and CSV downloads. Record actual results separately; passing local tests does not establish production protection.
