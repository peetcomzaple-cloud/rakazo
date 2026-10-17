# Jules Independent QA & Baseline Recheck Results

**Overall Offline Code & Typecheck Status (`67f37b16dc3c00584ac28bbdb1871e658e9516ff`): PASS (Offline Gates)**  
**Overall Live UI / 120-Minute Active Soak Status: BLOCKED / NOT_TESTED (Requires Live Environment & Paid Credentials)**

## 1. Baseline & Re-check Audit Summary
- **Earlier Baseline (`58c3c8c5a1fba747ea438086ad2ffac382c87918`):** Correctly classified as `BLOCKED / NOT ACCEPTED` due to TypeScript build errors in `@rakazo/sandbox-supervisor` and `@rakazo/adapters`.
- **Note on Jules PR #2 Commit `15e00be6945ea1736adbb073c5d3c11e77bc13da`:** When the Phase 0 re-check branch (`rakazo-repair-oct16-5635576951006946917`) merged `67f37b16dc3c00584ac28bbdb1871e658e9516ff`, its markdown text carried over the earlier `58c3c8c5` line numbers (`src/index.test.ts(952,1)`, `src/executor.ts(5114,42)`, `src/executor.ts(7313,36)`) while updating `case-results.json` to classify synthetic cases under `"role": "JULES-QA-MOCK-HARNESS"`.
- **Direct Verification on `67f37b16dc3c00584ac28bbdb1871e658e9516ff`:**
  1. **`@rakazo/sandbox-supervisor` Typecheck:**
     - Command: `node node_modules/typescript/bin/tsc --project infra/sandboxes/supervisor/tsconfig.json --noEmit --incremental false`
     - Exit Code: **`0`** (`0` errors)
  2. **`@rakazo/adapters` Typecheck:**
     - Command: `node node_modules/typescript/bin/tsc --project packages/adapters/tsconfig.json --noEmit --incremental false`
     - Exit Code: **`0`** (`0` errors; all required exports `isBrowserNoOp`, `isBrowserPreDispatchFailure`, `isBrowserUncertain`, `ToolCallStreakWithOutput`, `messageToAgentHistoryText`, `loadReplyContext`, and `ComputerObservation` fields are present and verified)
  3. **Production-Import Unit & Integration Suites (Vitest):**
     - `packages/adapters` (16 suites): **204 / 204 passed (`0` failed)**
     - `infra/sandboxes/supervisor` (`index.test.ts`, `page-browser-route.test.ts`): **59 passed, 1 skipped on Windows (`0` failed)**
  4. **Python Sandbox & Grader Invariant Suites:**
     - `python3 infra/sandboxes/computer/test_page_browser.py`: **20 / 20 passed**
     - `python3 infra/sandboxes/computer/test_focus_or_launch.py`: **22 passed, 3 skipped on Windows (`0` failed)**
     - `python3 work/d-r3-20261014/test_grader_invariants.py`: **20 / 20 passed** (6/6 Codex mutations rejected, 8/8 D mutations rejected, 6/6 real-PDF positive cases accepted)
     - `python3 work/after-d-r4-20261014/probe-new-mutations.py`: **10 / 10 mutations rejected (`falsePositiveCount: 0`)**

## 2. Mock Grader vs. Production Harness (`D07`)
- All 7 synthetic entries in `case-results.json` (`jules_q1_target_selection_popup` through `jules_q2_secret_leak`) are explicitly classified with `"role": "JULES-QA-MOCK-HARNESS"` and `"modelOrSelector": "Jules-Independent-Mocked"`.
- They are synthetic harness self-tests and **not** production correctness indicators.
- Any statement claiming that synthetic mock tests prove "Zero False Positives" across the production system is explicitly withdrawn.

## 3. UI Acceptance & Live Soak Verification Status
- Unchanged frontend files **do not remove** the original UI acceptance requirement. The Live UI and the 120-minute active soak remain `BLOCKED / NOT_TESTED` in offline environments lacking live UI endpoints, production session data, and funded model API credentials.
