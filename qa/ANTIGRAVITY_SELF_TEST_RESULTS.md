# Rakazo Architecture Implementation: Antigravity Self-Test Results

**Author:** Antigravity D (Lead Architecture Implementer & Integrator)  
**Date:** 2026-10-15 (Asia/Bangkok)  
**Workspace:** `C:\Users\User\Documents\Codex\2026-10-13\antigravity-chat-d-2-2\outputs\strategy-implementation-results`  
**Referenced Instructions & Protocols:**  
- `01_ANTIGRAVITY_IMPLEMENT.md` (Implementation phases and requirements)  
- `02_JULES_INDEPENDENT_QA.md` (Independent verification protocol)  
- `03_JEV_TEST_PROTOCOL.md` (Decision loop & Jev 14 invariants)  

---

## 1. Executive Summary & Verification Matrix

All 5 phases of the Rakazo Architecture implementation plan have been executed and verified across host environments (Windows x64 with Node.js v24.18.1 and Python 3.12.10) and remote Linux container staging (Oracle VM Ubuntu x86_64 running `rakazo-worker-1`).

| Phase | Description | Target Test Suites | Expected Outcome | Actual Outcome | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **Phase 0** | Grader Oracle & Invariant Hardening | `test_grader_invariants.py`, `probe-new-mutations.py` | 0 False Positives across 22 negative mutations; 6/6 positives PASS | 0 False Positives (100% rejection of 22/22 mutations; 6/6 positives accepted) | **PASS** |
| **Phase 1** | BrowserProvider Spike (Playwright CDP vs Agent Browser) | `browser-provider-spike.test.ts`, `browser-tools.test.ts`, `computer-browser.test.ts` | 8 fixtures (F1–F8) conformance across both drivers, single-owner isolation | 45/45 tests passed across spike and browser suites (16/16 spike passed) | **PASS** |
| **Phase 2** | Decision Loop & Jev Protocol Conformance | `jev-selector.test.ts` | Complete compliance with J01–J14 invariants; zero secrets leakage | 14/14 invariant tests passed (100% compliance) | **PASS** |
| **Phase 3A**| Document Engine & Font Embedding | `round3-docs-renderer.test.ts` | DejaVuSans + NotoSansThai fonts, 2D math layout, pagination, DOCX/XLSX/PPTX | 20/20 document tests passed with independent parser | **PASS** |
| **Phase 3B**| Search Engine & Readability Fallback | `searxng-web-search.test.ts`, `keyless-http-web.test.ts` | JSON search format, unresponsive engines handling, Readability fallback | 13/13 web search tests passed (5 SearXNG + 8 Keyless HTTP) | **PASS** |
| **Targeted**| Consolidated Targeted Regression Suite | 8 combined test files | 95 tests passing without regression | **95/95 tests passed (0 failures, 100%)** | **PASS** |

---

## 2. Test Execution Environments

1. **Host Environment A (Windows x64):**
   - Node.js runtime: `v24.18.1` (`C:\Users\User\AppData\Local\Programs\cursor\resources\app\resources\helpers\node.exe`)
   - Vitest: `v4.1.11` (`node_modules/vitest/vitest.mjs`)
   - Python runtime: `v3.12.10` (`C:\Users\User\.local\bin\python3.12.exe`)
   - Independent PDF library: `pypdf v6.20.1`
2. **Staging Environment B (Oracle VM Container):**
   - Host: `100.90.43.108` (Oracle Cloud Infrastructure, Ubuntu Linux 6.8.0-1017-oracle x86_64)
   - Container: `rakazo-worker-1` (`ghcr.io/elie222/rakazo/app:edge`)
   - Package manager: `pnpm 9.15.0`
   - Bind mounts: `/home/opc/rakazo/source/packages/adapters/src` $\rightarrow$ `/app/packages/adapters/src`
3. **AST / Binary Invariant Environment C:**
   - Isolated AST evaluator operating on static test files without network dispatch or API token exposure.

---

## 3. Detailed Results by Phase

### Phase 0: Grader Oracle & Invariant Hardening
- **Command:** `& "C:\Users\User\.local\bin\python3.12.exe" work\d-r3-20261014\test_grader_invariants.py`
  - **Codex R3 Negative Mutations (6 cases):** 6/6 rejected as `FAIL` (Expect 6/6).
    - `zcom`: Rejected (Z.com login form not reached, handed off as blocker/redirect).
    - `shopee`: Rejected (Shopee search incomplete, search_exec=True, result empty).
    - `login`: Rejected (Protected login not completed with verified auth).
    - `close`: Rejected (Window close action unverified).
    - `doc-pdf`: Rejected (PDF generation failed or invalid artifact).
    - `doc-transcript`: Rejected (Run produced no genuine transcript tools, artifacts, or provenance).
  - **D R3 Negative Mutations (6 cases):** 6/6 rejected as `FAIL` (Expect 6/6).
    - `zcom_stuck_home`: Rejected.
    - `shopee_no_results`: Rejected.
    - `login_wrong_origin`: Rejected.
    - `close_still_open`: Rejected.
    - `doc-pdf_truncated`: Rejected.
    - `doc-transcript_fabricated`: Rejected.
  - **Verified Positive Cases (6 cases):** 6/6 accepted as `PASS` (Expect 6/6).
    - Successfully reached Z.com login with visible form: `PASS`
    - Shopee search executed with fresh result items: `PASS`
    - Protected login completed via request_secret: `PASS`
    - Browser window close command explicitly dispatched: `PASS`
    - Document renderer invoked with valid PDF structure: `PASS`
    - Transcript processing completed with verified provenance: `PASS`
- **Command:** `& "C:\Users\User\.local\bin\python3.12.exe" work\after-d-r4-20261014\probe-new-mutations.py`
  - Tested 10 newly introduced R4 mutations in `grader-new-results.json`:
    - `pdf_markers_without_parseable_pdf` $\rightarrow$ `FAIL` (Caught by strict `pypdf.PdfReader` syntax parser)
    - `pdf_unrelated_render_effect_no_bytes` $\rightarrow$ `FAIL` (Caught by artifact ID correlation)
    - `zcom_hostname_in_attacker_path` $\rightarrow$ `FAIL` (Caught by strict URL hostname parser `re.match(r'^[a-zA-Z]+://([^/:]+)')`)
    - `zcom_origin_and_form_from_different_effects` $\rightarrow$ `FAIL` (Caught by origin correlation)
    - `auth_missing_origin_missing_fill` $\rightarrow$ `FAIL` (Missing verified auth effect)
    - `auth_target_in_wrong_hostname` $\rightarrow$ `FAIL` (Origin mismatch)
    - `close_failed_inventory_zero` $\rightarrow$ `FAIL` (Status failed)
    - `close_previous_run_inventory_zero` $\rightarrow$ `FAIL` (Stale timestamp rejected)
    - `shopee_future_missing_bytes_wrong_origin` $\rightarrow$ `FAIL` (Future timestamp / missing search items)
    - `transcript_failed_unrelated_read_only` $\rightarrow$ `FAIL` (No provenance)
  - **Result:** `falsePositiveCount: 0` (Zero false positives confirmed).

---

### Phase 1: BrowserProvider Vertical Slice & Spike
- **Command:** `& "node.exe" "node_modules/vitest/vitest.mjs" run packages/adapters/src/browser-provider-spike.test.ts`
- **Summary:** 16/16 tests passed across both `playwright-cdp` and `agent-browser` protocols.
- **Fixture Verification:**
  - `F1 (Navigation)`: Verified HTTPS URL validation, rejection of malicious/insecure protocols, and page load completion.
  - `F2 (Snapshot & Stable Refs)`: Generated accessible DOM snapshot tree with deterministic reference IDs (`e1`, `e2`, ...).
  - `F3 (Click & Fill)`: Dispatched click and keyboard fill events to target refs with post-action DOM state mutation confirmation.
  - `F4 (Select Dropdown)`: Verified option selection on native dropdown elements.
  - `F5 (Iframe Traversal)`: Isolated frame scopes and executed actions within targeted child frames.
  - `F6 (Popup Handling)`: Managed multi-window navigation without leaking lease handles.
  - `F7 (Viewport Screenshot)`: Emitted valid PNG screenshot buffer for visual verification.
  - `F8 (Lifecycle Lease & Single-Owner Isolation)`:
    - Calling `detach()` leaves the user browser running cleanly without process termination.
    - Calling `close()` terminates only windows belonging to the current run owner without killing desktop sessions or unrelated processes.
    - Verified monotonic fence enforcement (`screen-lease` contract).
- **Spike Selection:** **`playwright-cdp`** was selected as default implementation over `agent-browser` because:
  1. Communicates directly via in-process Chrome DevTools Protocol without spawning external subprocesses.
  2. Preserves strict memory isolation and supports granular frame/window lifecycle tracking.
  3. Avoids CLI argument serialization bottlenecks and external binary dependencies.

---

### Phase 2: Decision Loop & Jev Protocol Conformance
- **Command:** `& "node.exe" "node_modules/vitest/vitest.mjs" run packages/adapters/src/jev-selector.test.ts`
- **Summary:** 14/14 tests passed (100% compliance with `03_JEV_TEST_PROTOCOL.md`).
- **Invariant Verification (J01–J14):**
  - **J01 (Candidate Generation):** Converts DOM tree into clean, numbered action candidates without DOM noise.
  - **J02 (Deterministic Grounding):** Refuses ungrounded actions that reference non-existent element IDs.
  - **J03 (Confidence & Ranking):** Emits structured rationale and ranking for proposed subgoals.
  - **J04 (No-Match Handling):** Emits `status: "no_match"` when target intent cannot be satisfied by visible elements.
  - **J05 (Ambiguous Resolution):** Flags ambiguous targets (e.g. multiple identical search buttons) and requests clarification.
  - **J06 (Wait Condition):** Emits `status: "wait"` for asynchronous DOM transitions or pending redirects.
  - **J07 (Blocked State):** Emits `status: "blocked"` when detecting CAPTCHAs, bot shields, or security checkpoints.
  - **J08 (Need-Input Escalation):** Emits `status: "need_input"` for required user inputs (e.g. 2FA, SMS OTP).
  - **J09 (Zero Secrets Leakage):** Credentials, tokens, and passwords resolved strictly at runtime via `request_secret`; zero credential values appear in prompt payloads or selector candidate streams.
  - **J10 (Lease Fence Check):** Rejects actions if monotonic lease fence has expired or ownership was ceded.
  - **J11 (Post-Action Verification):** Verifies actual DOM mutation before confirming subgoal completion; prevents false "goal accomplished" claims on landing pages.
  - **J12 (Chinese Model Structuring):** Compatible with DeepSeek-R1 / DeepSeek-V3 and Qwen 2.5 structured JSON output formatting.
  - **J13 (Malformed Rejection):** Rejects invalid JSON, NaN candidates, or out-of-bounds indices cleanly without crashing the decision loop.
  - **J14 (Live Reporting Protocol):** When hosted Jev API keys are not provisioned in the environment, the adapter reports live conformance as `NOT_TESTED` without blocking offline operation or falsifying results.

---

### Phase 3: Search, Readability & Document Engines
- **Command:** `& "node.exe" "node_modules/vitest/vitest.mjs" run packages/adapters/src/round3-docs-renderer.test.ts`
  - **Summary:** 20/20 document tests passed.
  - **Features Verified:**
    - Full font embedding of `DejaVuSans.ttf`, `NotoSansThai-Regular.ttf`, and `NotoSansThai-Bold.ttf`.
    - Proper Thai character shaping without font substitution boxes.
    - 2D mathematical formula rendering (fractions, matrices) without leaking `$$` delimiter artifacts into raw text.
    - Multi-page document pagination and table line wrapping.
    - Export support for DOCX, XLSX, PPTX, and HTML.
    - Strict rejection of placeholder bytes, empty files, or corrupted byte streams.
- **Command:** `& "node.exe" "node_modules/vitest/vitest.mjs" run packages/adapters/src/searxng-web-search.test.ts`
  - **Summary:** 5/5 tests passed.
  - **Features Verified:**
    - Parses SearXNG JSON response into standard `WebSearchHit` format (`title`, `url`, `snippet`).
    - Clamps search hits to requested `maxResults`.
    - Handles zero search results cleanly without throwing exceptions.
    - Gracefully tolerates unresponsive engines (`unresponsive_engines: [["google", "timeout"]]`).
    - Automatically falls back to `KeylessHttpWebProvider` when SearXNG instance is unreachable.
    - Extracts clean article content via Readability on `fetch()`.

---

## 4. Consolidated Targeted Vitest Suite Execution

To confirm complete harmony across all newly integrated subsystems without regressions, the 8 targeted test files were executed concurrently:

```bash
& "node.exe" "node_modules/vitest/vitest.mjs" run \
  packages/adapters/src/browser-provider-spike.test.ts \
  packages/adapters/src/browser-tools.test.ts \
  packages/adapters/src/computer-browser.test.ts \
  packages/adapters/src/browser-conformance.test.ts \
  packages/adapters/src/jev-selector.test.ts \
  packages/adapters/src/searxng-web-search.test.ts \
  packages/adapters/src/round3-docs-renderer.test.ts \
  packages/adapters/src/keyless-http-web.test.ts
```

**Results:**
```text
 ✓ packages/adapters/src/jev-selector.test.ts (14 tests) 9ms
 ✓ packages/adapters/src/round3-docs-renderer.test.ts (20 tests) 61ms
 ✓ packages/adapters/src/browser-provider-spike.test.ts (16 tests) 389ms
 ✓ packages/adapters/src/browser-conformance.test.ts (3 tests) 137ms
 ✓ packages/adapters/src/searxng-web-search.test.ts (5 tests) 139ms
 ✓ packages/adapters/src/computer-browser.test.ts (13 tests) 142ms
 ✓ packages/adapters/src/keyless-http-web.test.ts (8 tests) 169ms
 ✓ packages/adapters/src/browser-tools.test.ts (16 tests) 217ms

 Test Files  8 passed (8)
      Tests  95 passed (95)
   Duration  6.42s
```

---

## 5. Cost Ledger & Resource Accounting

| Metric | Previous Cumulative | Incremental (This Session) | Total Current | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Paid API Calls** | 135 calls | **0 calls** | 135 calls | All tests executed offline via local node/python test harnesses |
| **Paid API Cost** | $0.13161910 USD | **$0.00000000 USD** | $0.13161910 USD | Zero budget consumed during architecture refactor and unit testing |
| **Unknown Usage Calls** | 0 calls | 0 calls | 0 calls | Strict accounting maintained |
| **Remaining Budget Margin** | — | — | **Ample** | Baseline preserved for upcoming authorized live QA runs |

---

## 6. Limitations & Untested Scenarios

In accordance with strict verification rules, the following items are explicitly recorded as **not yet tested live**:
1. **Live Jev Ultrafast Cloud API:** The protocol conformance is verified 100% offline via `jev-selector.test.ts` (J01–J14). Live cloud invocation is recorded as **`NOT_TESTED`** due to lack of hosted vendor API key and budget reservation constraints.
2. **120-Minute Live Chat UI Soak:** A 120-minute continuous live chat UI acceptance test was not executed in this offline integration phase. Full end-to-end live testing requires user authorization for paid live model calls. The system is marked **`READY_FOR_LIVE_QA`**.
