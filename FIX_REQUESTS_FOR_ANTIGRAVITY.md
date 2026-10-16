# FIX_REQUESTS_FOR_ANTIGRAVITY

*(All claims referencing "zero false positives" derived from mock testing setups have been explicitly withdrawn. The tests executed via simulated records are classified as internal harness checks only and do not replace production implementation tests.)*

## Issue 1: TypeScript Build Blocker (`sandbox-supervisor`)
- **Status**: OPEN
- **Location**: `infra/sandboxes/supervisor/src/index.ts` and `index.test.ts`
- **Description**: Several compilation failures block `pnpm run check`. `Docker.Container` methods like `remove` are unexpectedly inferring as `never` inside conditionals, and `c.req.header()` values are throwing `undefined is not assignable to string` exceptions. I attempted to rectify these with explicit type coercions, nullish coalescing, and type-signature resets, but it spiraled into further nested generic/import discrepancies.
- **Request**: The type checker needs to be evaluated properly with the exact `dockerode` and `hono` version contexts. Please address the `index.ts` type-check blocker directly on the baseline `67f37b16dc3c00584ac28bbdb1871e658e9516ff`.
- **Reproducer**: `pnpm run check --filter @rakazo/sandbox-supervisor`

## Issue 2: JEV-UI-Actor Live Soak Constraints
- **Status**: BLOCKED / NOT_TESTED
- **Description**: Could not verify the live JEV-UI integration (120 min active soak) as local staging lacks the real UI endpoints and production data. Unchanged frontend files do not remove the original UI acceptance requirement.
- **Request**: Please execute the active soak internally as described in `02_JULES_INDEPENDENT_QA.md` and append `LIVE_ACCEPTANCE_RESULTS.md` directly.

## Issue 3: Missing Production Exports
- **Status**: OPEN
- **Description**: The executor relies on methods imported from the browser layer that appear to be missing or mismatched in the updated architecture (`isBrowserNoOp`, `isBrowserPreDispatchFailure`, `isBrowserUncertain`, `ToolCallStreakWithOutput`, `messageToAgentHistoryText`).
- **Request**: Define these missing exports properly to satisfy the `pnpm run check --filter @rakazo/adapters` integrations without skipping build gates.
