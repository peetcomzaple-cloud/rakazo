# Jules Independent QA: Setup & Reproduction Instructions

**Author:** Antigravity D (Lead Architecture Implementer & Integrator)  
**Recipient:** Jules (Independent QA Inspector)  
**Date:** 2026-10-15 (Asia/Bangkok)  
**Location:** `outputs/strategy-implementation-results/JULES_QA_SETUP_INSTRUCTIONS.md`  
**Referenced Protocol:** `outputs/strategy-implementation-prompts/02_JULES_INDEPENDENT_QA.md`  

---

## 1. Codebase Baseline & Repository Snapshot

To prevent testing against obsolete GitHub branches or mismatched dependencies, use the following pinned snapshot information:

- **Repository Root:** `/home/opc/rakazo/source` (on Oracle staging VM) or fresh local clone
- **Git Branch:** `main`
- **Pinned HEAD Commit:** `0c067de5`
- **Dirty Tree / Synchronized Adapter Files:** All newly developed implementation files have been copied directly to `/home/opc/rakazo/source/packages/adapters/src/`, which is bind-mounted directly into the staging container `rakazo-worker-1` at `/app/packages/adapters/src/`.
- **Runtime Environment:**
  - OS: Linux x86_64 (Ubuntu 24.04 LTS / Kernel 6.8.0-1017-oracle)
  - Node.js: `v20.x` / `v24.x` (container default)
  - pnpm: `9.15.0`
  - Vitest: `v4.1.11`
  - Python: `>= 3.10` with `pypdf v6.20.1`

---

## 2. Portable Setup & Execution (No Windows-Specific Paths)

Jules can execute tests either directly inside the running container `rakazo-worker-1` or within a clean local VM.

### Option A: Execution Inside Running Staging Container (`rakazo-worker-1`)
This is the recommended path as all dependencies, font files, and environment bindings are pre-configured:

```bash
# 1. Access the Oracle VM via SSH (Tailscale network)
ssh oracle-server

# 2. Run the 4 core Rakazo Phase 1-3 adapter suites:
sudo docker exec -u root rakazo-worker-1 /app/node_modules/.bin/vitest run \
  packages/adapters/src/browser-provider-spike.test.ts \
  packages/adapters/src/jev-selector.test.ts \
  packages/adapters/src/searxng-web-search.test.ts \
  packages/adapters/src/round3-docs-renderer.test.ts

# 3. Run the companion browser & web provider regression suites:
sudo docker exec -u root rakazo-worker-1 /app/node_modules/.bin/vitest run \
  packages/adapters/src/keyless-http-web.test.ts \
  packages/adapters/src/computer-browser.test.ts \
  packages/adapters/src/browser-tools.test.ts \
  packages/adapters/src/browser-conformance.test.ts
```

### Option B: Execution on Clean Linux Machine / Workstation
From the repository root (`cd rakazo/source`):

```bash
# Install dependencies
pnpm install --frozen-lockfile

# Run targeted vitest suite
npx vitest run \
  packages/adapters/src/browser-provider-spike.test.ts \
  packages/adapters/src/jev-selector.test.ts \
  packages/adapters/src/searxng-web-search.test.ts \
  packages/adapters/src/round3-docs-renderer.test.ts \
  packages/adapters/src/keyless-http-web.test.ts \
  packages/adapters/src/computer-browser.test.ts \
  packages/adapters/src/browser-tools.test.ts \
  packages/adapters/src/browser-conformance.test.ts
```

---

## 3. Grader Oracle & Invariant Test Commands (Python)

To verify that the evaluation grader rejects negative mutations and accepts verified positive runs:

```bash
# Verify 12 mutations (6 Codex + 6 D) + 6 positive invariant cases
python3 work/d-r3-20261014/test_grader_invariants.py

# Verify 10 newly introduced R4 mutations (Zero False Positive validation)
python3 work/after-d-r4-20261014/probe-new-mutations.py
```

Expected output:
- `Codex mutations rejected: 6/6 (Expect 6/6)`
- `D mutations rejected: 6/6 (Expect 6/6)`
- `Positive cases accepted: 6/6 (Expect 6/6)`
- `falsePositiveCount: 0`

---

## 4. Staging Network, Ports & Security Guardrails

| Service | Address / Port | Access Rule / Protection |
| :--- | :--- | :--- |
| **Rakazo Web UI** | `http://100.90.43.108:5173` | Accessible over Tailnet for browser testing |
| **Rakazo API** | `http://127.0.0.1:3100` | Loopback only (or inside container network) |
| **Protected Computer Viewer** | `http://100.90.43.108:16080` | Read-only screen inspection via noVNC |
| **PostgreSQL Database** | `rakazo-postgres-1:5432` | **PROTECTED:** Never drop or restart with `-v` |
| **App Data Storage** | `rakazo_appdata` volume | **PROTECTED:** Contains persistent user routines & vaults |

> [!CAUTION]
> **Strict Security Constraints for Jules QA:**
> 1. Never bind port 5173 to public `0.0.0.0`.
> 2. Never print, dump, or include real user secrets, tokens, or private traces in reports or artifacts.
> 3. Never execute destructive system commands (`rm -rf`, `docker system prune`, `pkill -9`).

---

## 5. Live Acceptance & Readiness Declaration (`READY_FOR_LIVE_QA`)

### Readiness Status
The architecture changes have passed all self-tests, invariant checks, and container integration suites. The system is declared:
```text
STATUS: READY_FOR_LIVE_QA
```

### Proposed Minimal Batch for Live Testing
Because prior testing previously reached high call volumes, live testing should begin with a strictly constrained minimal batch:

1. **Test Scope (4 Core Scenarios):**
   - **Scenario A (Web Navigation):** Shopee/Z.com interactive navigation with visible form/results confirmation.
   - **Scenario B (Protected Secret Login):** Synthetic credentials submission via UI card $\rightarrow$ auth confirmation.
   - **Scenario C (Browser Lifecycle):** Explicit window close $\rightarrow$ verify window closed in inventory and screen lease released.
   - **Scenario D (Document Generation):** Thai/English + math PDF generation $\rightarrow$ download and independent byte parsing.
2. **Model Selection:**
   - Recommend pinned cost-efficient Chinese structured models: `deepseek-chat` or `qwen2.5-coder-32b`.
3. **Estimated Budget & Call Limit:**
   - Estimated calls per scenario: 3–4 calls.
   - Total batch call ceiling: **16 calls max** (~$0.02 USD total cost).
   - Single concurrency only (do not compete for screen lease).
