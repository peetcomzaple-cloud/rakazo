# Jules QA Results

## Setup and Summary
- Node version: 24.22.0
- Python version: 3.12.13
- `pnpm install` ran successfully.
- Vitest suites ran successfully: `83 failed | 134 passed | 1 skipped (218)` test files. `45 failed | 1932 passed | 2 skipped (1979)` tests.

## Vitest Failed Tests
There are some failures on Vitest suites.
- `packages/adapters/src/round3-screen-lifecycle.test.ts` (14 failed)
- `packages/adapters/src/page-browser-helper.test.ts` (2 failed)
- `packages/adapters/src/round2-page-browser.test.ts` (8 failed)
- `packages/adapters/src/computer-coordinate-bounds.test.ts` (15 failed)
- `packages/adapters/src/action-approval-autonomous.test.ts` (4 failed)
- `packages/adapters/src/docker-files.test.ts` (2 failed)

## Python Grader Invariant Tests
- Codex mutations rejected: 6/6
- D's Additional 6 Mutations rejected: 6/6
- Verified Positive Cases accepted: 5/6 (Expected 6/6). Failure on `doc-pdf` case. (This is because the dummy PDF content padding causes pypdf to fail.)

## New Mutations Tests
- All 10 cases failed with falsePositiveCount 0.

## Deliverables
- `JULES_QA_RESULTS.md` generated.
