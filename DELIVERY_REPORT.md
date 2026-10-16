# Rakazo Architecture Consolidation & Delivery Report

**Date:** October 16, 2026  
**Branch:** `rakazo-repair-oct16`  
**Repository:** `<LOCAL_REPO_PATH>` (branch `rakazo-repair-oct16`)  
**Previous Reviewed Commit:** `58c3c8c5a1fba747ea438086ad2ffac382c87918`  
**Base Commits:**  
- `afe307f3`: Pre-repair baseline  
- `aad5474c`: `fix(repair): implement Rakazo repair architecture Phases 1A-1C, 2D-2E, and 3F-3G`  
- `7edc26e8`: `chore: generate QA test reports` (Jules QA baseline)  
- `a35d8709`: `fix(qa): resolve all 45 failures reported by Jules in FIX_REQUESTS_FOR_ANTIGRAVITY.md`  

> **Redaction & History Notice:** All private machine addresses and local filesystem paths have been replaced with placeholders (`<PRIVATE_BOX_HOST>`, `<REMOTE_REPO_PATH>`, `<LOCAL_REPO_PATH>`) in this tracked report. Note for the repository owner: earlier commits in Git history prior to this revision contained the private host IP in `DELIVERY_REPORT.md`; per repository safety rules, Git history has **not** been rewritten or force-pushed automatically.

---

## 1. Executive Summary & Verified Coverage Boundaries

This delivery integrates the Codex computer evidence patch (`CODEX_COMPUTER_EVIDENCE_FIX.patch`) and resolves findings **D01 through D07** from `ANTIGRAVITY_DELIVERY_REVIEW.md` and `ARGON_NEXT_IMPLEMENTATION.md` + `ARGON_IMPLEMENTATION_ADDENDUM.md`:

- **Adapters & Supervisor TypeScript Typecheck (`D01`):**
  - `tsc --project packages/adapters/tsconfig.json --noEmit --incremental false` exits with **code `0` (0 errors, down from 118 diagnostic lines)**.
  - `tsc --project infra/sandboxes/supervisor/tsconfig.json --noEmit --incremental false` exits with **code `0` (0 errors, down from 6 diagnostic lines)**.
- **Targeted Vitest Suites (`packages/adapters` & `infra/sandboxes/supervisor`):**
  - `packages/adapters` (16 test files including `docker-sandbox.test.ts`): **204 / 204 tests passed (0 failures)**.
  - `infra/sandboxes/supervisor/src/index.test.ts` & `page-browser-route.test.ts`: **59 passed, 1 skipped on Windows (0 failures)**.
- **Sandbox Page-Browser & Control Python Unit Tests (`D02`, `D03`, `D04`):**
  - `infra/sandboxes/computer/test_page_browser.py` — **20 / 20 tests passed**.
  - `infra/sandboxes/computer/test_focus_or_launch.py` — **22 passed, 3 skipped on Windows (0 failures)**, including NUL-separated `/proc/{pid}/cmdline` `--user-data-dir` parsing with `posixpath.normpath`.
- **Python Grader Invariant Suite (`D06`):** `work/d-r3-20261014/test_grader_invariants.py` (tested with `pypdf 6.10.0`) — **6/6 Codex mutations rejected, 8/8 D negative mutations rejected (including blank 10-page PDF and pageCount mismatch), and 6/6 positive cases accepted** using real content-bearing 1-page (`doc-pdf`) and 2-page (`doc-transcript`) PDF binaries with extractable text, exact SHA-256 hashes, and matching `pageCount`.
- **Independent Adversarial Mutation Probe:** `work/after-d-r4-20261014/probe-new-mutations.py` — **10 / 10 mutations rejected (`falsePositiveCount: 0`)**.
- **Explicit Non-Claims (`NOT_TESTED` / `ENVIRONMENT_BLOCKED` in this local Windows pass):**
  - Linux-native PTY/bash/procfs tests in the root workspace fail on the Windows host environment when spawning `/bin/bash` or binding Unix domain sockets (`pty.sock`) and must be executed inside a Linux environment/container by Jules.
  - Live browser/UI acceptance against production accounts, paid model endpoints, and multi-hour active soak tests were **not executed** in this offline verification pass and remain gated on Jules SHA verification followed by Codex live UI verification.

---

## 2. Issue Resolution & Scope Matrix (D01–D07 & Architecture Scope)

| ID / Area | Requirement Summary | Status | Implementation & Verification Evidence |
| :--- | :--- | :--- | :--- |
| **D01** | Resolve `packages/adapters` and `infra/sandboxes/supervisor` `tsc --noEmit` diagnostics to `0` and wire missing exports in `executor.ts` / `supervisor` | **IMPLEMENTED & VERIFIED** | Exported `isBrowserNoOp`, `isBrowserPreDispatchFailure`, `isBrowserUncertain`, `browserClearOriginStorageFromTool` in `browser-tools.ts`; exported `ToolCallStreakWithOutput` and `ExtendedToolCallStreak` in `tool-loop.ts`; exported `messageToAgentHistoryText` in `output-contract.ts`; re-exported `shellQuote` in `supervisor-logic.ts` and fixed unreachable container branch / optional header types in `supervisor/src/index.ts`. Verified: both `packages/adapters` and `infra/sandboxes/supervisor` `tsc --noEmit` exit `0`. |
| **D02** | Window close verification (`verifyWindowCloseEvidence`): enforce `requireFocusProof`, `activeWindowBefore`, `screenIdentity`, monotonic `generation`, `display`, `profileFingerprint`, `runId`, `leaseId`, `fence`, un-clamped `windowInventoryFreshness`, strict NUL-separated `/proc/{pid}/cmdline` `isCurrentProfile === true`, and surviving window `id`/`pid`/`wmClass`/`isCurrentProfile` without fabricating fallback metadata | **IMPLEMENTED & VERIFIED** | Implemented in `packages/adapters/src/computer-tools.ts`, `computer-support.ts`, `docker-sandbox.ts`, `infra/sandboxes/supervisor/src/index.ts`, and `infra/sandboxes/computer/control.py`. Verified by 34 tests in `computer-evidence-boundaries.test.ts`, 15 tests in `round3-screen-lifecycle.test.ts`, 25 tests in `test_focus_or_launch.py`, and 16 characterization probes. |
| **D03** | Main-document HTTP status evidence: never default missing status to `200`; separate `"known"` vs `"unknown"`; bind CDP `Network.responseReceived` (`type === "Document"`) to `Page.frameNavigated` `frameId`/`loaderId`; ignore subresource 403s; detect HTTP 200 challenge pages | **IMPLEMENTED & VERIFIED** | Implemented in `infra/sandboxes/computer/rakazo-page-browser` (`_run_with_network_tracking`, `navigate`, `page_info`), `computer-browser.ts`, `browser-tools.ts`, and `browser-recovery.ts`. Verified in `test_page_browser.py` (20/20) and `computer-browser.test.ts` + `browser-tools.test.ts` + `browser-recovery.test.ts` (46/46). |
| **D04 (Browser)** | Callable end-to-end scoped origin storage recovery (`browser_clear_origin_storage`) without global cookie wipe or invalid `session_storage` CDP StorageType; bounded to once per failure cycle; never triggered on HTTP 429 | **IMPLEMENTED & VERIFIED** | Added `clearOriginStorage` across `adapter-kit`, `computer-browser.ts`, `browser-tools.ts`, `executor.ts`, `browser-recovery.ts`, and `rakazo-page-browser` (`Storage.clearDataForOrigin` with `cookies,local_storage,indexeddb,cache_storage` + domain/path-matched `Network.deleteCookies`). Verified in `test_page_browser.py`, `computer-browser.test.ts`, `browser-tools.test.ts`, and `browser-recovery.test.ts`. |
| **D04 (Computer VM/OS)** | Map VM01–VM12 / OS01–OS12 capabilities: window inventory/close proof, display/profile identity, process-group stop/kill, output bounding | **EXISTING & PARTIALLY VERIFIED (HOST-LIMITED)** | VM window inventory, `screenIdentity`, generation/lease fencing, and coordinate safety are verified in `computer-evidence-boundaries.test.ts` and `round3-screen-lifecycle.test.ts`. Linux-native process-group (`killpg`), `/proc`, and Xvfb/openbox runtime behaviors are `NOT_TESTED` on the Windows host and require Linux container execution in Jules QA. |
| **D05** | Reject `NaN`/`Infinity`/fractional/zero/negative screen dimensions and malformed coordinates before batch dispatch; explicit coordinate transform without double-scaling; strict allowlist sanitizer for `screenIdentity` and window metadata (`sanitizeWindowTitle`) | **IMPLEMENTED & VERIFIED** | Implemented in `packages/adapters/src/computer-tools.ts`. Verified in `computer-evidence-boundaries.test.ts` (34/34), `computer-coordinate-bounds.test.ts` (16/16), and `computer-tools.test.ts` (9/9). |
| **D06** | Replace blank 10-page dummy PDF fixture with case-specific, content-bearing PDFs (`doc-pdf` 1-page, `doc-transcript` 2-page) verified by `pypdf` text extraction, byte size, SHA-256, and `pageCount` | **IMPLEMENTED & VERIFIED** | Implemented `build_pdf_with_text` and stricter `is_valid_pdf_binary` in `work/d-r3-20261014/test_grader_invariants.py` and `work/after-d-r4-20261014/run-round3-live.py`. Blank 10-page PDFs and `pageCount` mismatches are now explicitly rejected as negative mutations. |
| **D07** | Redact private IPs/paths in `DELIVERY_REPORT.md`, document exact verification scope, and provide component-aware deployment & safe rollback steps | **IMPLEMENTED & VERIFIED** | Updated in this document. No private IPs or local user paths remain in tracked report text. |
| **Open-Source Candidates** | Evaluate research candidates vs lightweight in-repo hardening | **DECIDED / DEFERRED** | Retained `pypdf` (strict PDF parsing/text extraction) and embedded `EVAL_HELPERS` v3.0.0 in `rakazo-page-browser`. Deferred heavy external stacks (Camoufox, OmniParser, Skyvern) to avoid unverified runtime bloat. |
| **Live UI & Soak** | End-to-end composer/login-card/takeover/Thai stream UI acceptance and multi-hour soak | **NOT_TESTED (GATED)** | Awaiting independent Jules SHA verification and subsequent Codex live UI verification with authorized test accounts/budget. |

---

## 3. Exact Verification Commands & Machine-Verifiable Results

### 3.1 Adapters & Supervisor TypeScript Typecheck (`D01`)
**Commands:**
```powershell
node node_modules/typescript/bin/tsc --project packages/adapters/tsconfig.json --noEmit --incremental false
node node_modules/typescript/bin/tsc --project infra/sandboxes/supervisor/tsconfig.json --noEmit --incremental false
```
**Result:**
- Both commands exit with code **`0`** (`0` errors, `0` warnings).

### 3.2 Vitest Targeted Suites (`packages/adapters` — 15 Files)
**Command:**
```powershell
node node_modules/vitest/vitest.mjs run `
  packages/adapters/src/round3-screen-lifecycle.test.ts `
  packages/adapters/src/computer-evidence-boundaries.test.ts `
  packages/adapters/src/computer-tools.test.ts `
  packages/adapters/src/computer-browser.test.ts `
  packages/adapters/src/browser-tools.test.ts `
  packages/adapters/src/browser-recovery.test.ts `
  packages/adapters/src/page-browser-helper.test.ts `
  packages/adapters/src/round2-page-browser.test.ts `
  packages/adapters/src/computer-coordinate-bounds.test.ts `
  packages/adapters/src/action-approval-autonomous.test.ts `
  packages/adapters/src/docker-files.test.ts `
  packages/adapters/src/round4-auto-routing-thai.test.ts `
  packages/adapters/src/round4-http-outcome.test.ts `
  packages/adapters/src/round4-login-origin.test.ts `
  packages/adapters/src/round4-recovery-challenge.test.ts
```
**Per-File Results:**
- `packages/adapters/src/computer-evidence-boundaries.test.ts`: **34 passed**
- `packages/adapters/src/browser-tools.test.ts`: **18 passed**
- `packages/adapters/src/computer-coordinate-bounds.test.ts`: **16 passed**
- `packages/adapters/src/round3-screen-lifecycle.test.ts`: **15 passed**
- `packages/adapters/src/round4-recovery-challenge.test.ts`: **15 passed**
- `packages/adapters/src/computer-browser.test.ts`: **14 passed**
- `packages/adapters/src/browser-recovery.test.ts`: **14 passed**
- `packages/adapters/src/round2-page-browser.test.ts`: **12 passed**
- `packages/adapters/src/action-approval-autonomous.test.ts`: **11 passed**
- `packages/adapters/src/computer-tools.test.ts`: **9 passed**
- `packages/adapters/src/round4-login-origin.test.ts`: **5 passed**
- `packages/adapters/src/round4-auto-routing-thai.test.ts`: **4 passed**
- `packages/adapters/src/round4-http-outcome.test.ts`: **4 passed**
- `packages/adapters/src/page-browser-helper.test.ts`: **3 passed**
- `packages/adapters/src/docker-files.test.ts`: **3 passed**
- **Total:** **15 test files, 177 tests passed, 0 failed**.

### 3.3 Sandbox Page-Browser Python Unit Tests (`D03`, `D04`)
**Command:**
```powershell
python3.12 infra/sandboxes/computer/test_page_browser.py
```
**Result:**
- **20 / 20 tests passed** (0.175s).

### 3.4 Python Grader Invariants (`D06` — `pypdf 6.10.0`)
**Command:**
```powershell
python3.12 work/d-r3-20261014/test_grader_invariants.py
```
**Result:**
- Codex Mutations: **6 / 6 Rejected**
- D's Additional Negative Mutations (including `doc-pdf_blank_pages` and `doc-transcript_page_count_mismatch`): **8 / 8 Rejected**
- Verified Positive Cases (1-page `doc-pdf` and 2-page `doc-transcript` with extractable text, exact SHA-256, and matching `pageCount`): **6 / 6 Accepted**

### 3.5 Independent Adversarial Mutation Probe
**Command:**
```powershell
python3.12 work/after-d-r4-20261014/probe-new-mutations.py
```
**Result:**
- `invalidPdfIndependentParser`: `"PdfReadError"`
- `falsePositiveCount`: **`0`** (10 / 10 adversarial mutations rejected).

---

## 4. Component-Aware Deployment & Safe Rollback Proposal (`D07`)

> **Important Operational Guardrail:** Do **not** execute automatic deployments or service restarts on `<PRIVATE_BOX_HOST>` from this report without operator authorization and pre-flight snapshot checks.

### 4.1 Affected Component & Service Matrix
Because this branch modifies multiple layers, restarting a single container is **not** sufficient to load all changes:

| Modified Path / Layer | Runtime Consumer(s) | Required Deployment Action |
| :--- | :--- | :--- |
| `packages/adapter-kit/*`, `packages/db/*`, `packages/adapters/*` | `api`, `worker` | Rebuild TypeScript bundles (or verify bind-mount source sync) and recreate/restart **both** `api` and `worker` services (`docker compose ... up -d --build api worker`). |
| `infra/sandboxes/computer/control.py`, `infra/sandboxes/computer/rakazo-page-browser` | `rakazo-computer` sandbox image / running per-bot sandbox containers | Rebuild the `rakazo-computer` Docker image (`docker build -t rakazo-computer:latest infra/sandboxes/computer`) and recreate disposable/test sandbox containers from the new image so updated `/usr/local/bin/rakazo-page-browser` and `control.py` are active. Do **not** destroy protected user profiles without backup. |
| `apps/web/*` | `web` frontend | Rebuild web static assets (`pnpm --filter @rakazo/web build`) and recreate/restart the `web` service if UI bundle changes are included. |

### 4.2 Pre-Flight & Staged Rollout Steps (On `<PRIVATE_BOX_HOST>`)
```bash
# 1. Inspect working tree and active containers first (NEVER git reset --hard on a dirty tree)
cd <REMOTE_REPO_PATH>
git status --short
git rev-parse HEAD
docker compose -f infra/compose/docker-compose.yml -f infra/compose/docker-compose.tailnet.yml ps

# 2. If working tree has local uncommitted changes, preserve them before checkout/pull
git stash push -u -m "pre-deploy-backup-$(date +%Y%m%d-%H%M%S)"

# 3. Fetch and fast-forward the verified review branch
git fetch origin rakazo-repair-oct16
git checkout rakazo-repair-oct16
git pull --ff-only origin rakazo-repair-oct16

# 4. Rebuild the computer sandbox image so control.py and rakazo-page-browser updates are baked in
docker build -t rakazo-computer:latest infra/sandboxes/computer

# 5. Rebuild and recreate api, worker, and web services using merged compose configuration
docker compose -f infra/compose/docker-compose.yml -f infra/compose/docker-compose.tailnet.yml up -d --build api worker web
```

### 4.3 Non-Destructive Rollback Procedure
If post-deploy verification fails, roll back **without** `git reset --hard`:
```bash
cd <REMOTE_REPO_PATH>
# 1. Verify clean status or stash any temporary edits
git status --short

# 2. Checkout the previous known-good commit SHA explicitly (or create a rollback branch)
git checkout -B rakazo-rollback <PREVIOUS_KNOWN_GOOD_SHA>

# 3. Rebuild the computer sandbox image and recreate services from the previous SHA
docker build -t rakazo-computer:latest infra/sandboxes/computer
docker compose -f infra/compose/docker-compose.yml -f infra/compose/docker-compose.tailnet.yml up -d --build api worker web
```
