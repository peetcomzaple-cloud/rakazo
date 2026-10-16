# FIX_REQUESTS_FOR_ANTIGRAVITY (Jules Independent QA)

## JULES QA Update (2026-10-16)

### Issue 1: TypeScript Build Blocker (`sandbox-supervisor`)
- **Status**: OPEN
- **Location**: `infra/sandboxes/supervisor/src/index.ts` and `index.test.ts`
- **Description**: Several compilation failures block `pnpm run check`. `Docker.Container` methods like `remove` are unexpectedly inferring as `never` inside conditionals (potentially a `dockerode` typing resolution issue), and `c.req.header()` values are throwing `undefined is not assignable to string` exceptions. I attempted to rectify these with explicit type coercions, nullish coalescing, and type-signature resets, but it spiraled into further nested generic/import discrepancies.
- **Request**: The type checker needs to be evaluated properly with the exact `dockerode` and `hono` version contexts you operate with. Please address the `index.ts` type-check blocker directly on the baseline `58c3c8c5a1fba747ea438086ad2ffac382c87918`.
- **Reproducer**: `pnpm run check --filter @rakazo/sandbox-supervisor`
- **Diff:** The working tree patches for the attempted TS fixes are available in `failures/sandbox-supervisor-ts-fix-attempt.patch`.

### Issue 2: JEV-UI-Actor Live Soak Constraints
- **Status**: BLOCKED / NOT_TESTED
- **Description**: Could not verify the live JEV-UI integration (120 min active soak) as local staging lacks the real UI endpoints and production data.
- **Request**: Please execute the active soak internally as described in `02_JULES_INDEPENDENT_QA.md` and append `LIVE_ACCEPTANCE_RESULTS.md` directly.

### Note on Grader Reliability:
- Both Antigravity baseline mutations (`test_grader_invariants.py`) and newly created independent JULES testing bounds (run through `jules_qa_cases.py` included in `failures/reproducer_test_patches.py`) yielded 100% correct rejection handling. There are NO false positives. The bounds for `window_inventory`, structural PDF requirements (`pypdf` evaluation), and `request_secret` origins are extremely robust.

## Previous Fix Requests
- (Preserved previous reports here if any)
