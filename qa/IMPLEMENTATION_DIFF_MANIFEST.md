# Rakazo Architecture Implementation: Diff & Runtime Manifest

**Author:** Antigravity D (Lead Architecture Implementer & Integrator)  
**Date:** 2026-10-15 (Asia/Bangkok)  
**Workspace:** `C:\Users\User\Documents\Codex\2026-10-13\antigravity-chat-d-2-2\outputs\strategy-implementation-results`  
**Reference Strategy Documents:**  
- `outputs/CODEX_REVIEWER_ANTIGRAVITY_PLAYBOOK.md`  
- `outputs/strategy-review-20261015/RAKAZO_STRATEGY_PLAN.md`  
- `outputs/strategy-implementation-prompts/01_ANTIGRAVITY_IMPLEMENT.md`  
- `outputs/strategy-implementation-prompts/02_JULES_INDEPENDENT_QA.md`  
- `outputs/strategy-implementation-prompts/03_JEV_TEST_PROTOCOL.md`  

---

## 1. Executive Summary of Changes

In accordance with the Rakazo Architecture implementation plan, the system was refactored across 5 distinct phases to achieve modularity, predictable decision loops, deterministic security fences, and complete independent test verification:

1. **Phase 0 (Baseline & Oracle Regression):** Hardened the evaluation grader against hostname path injection, fake PDF byte markers, artifact cross-contamination, failed inventory status, and unverified landing page claims. Achieved **0 false positives** across 22 negative mutation counterexamples (6 Codex R3 mutations, 6 D R3 mutations, 10 R4 mutations in `grader-new-results.json`) while maintaining 100% acceptance (6/6) of verified positive runs.
2. **Phase 1 (BrowserProvider Vertical Slice & Spike):** Implemented `SpikeBrowserProvider` supporting two alternative protocols: `playwright-cdp` (direct in-process Chrome DevTools Protocol) and `agent-browser` (CLI wrapper). Implemented full compliance across 8 standard fixtures (F1–F8: navigation, element snapshot with stable refs, click/fill, select, iframe isolation, popup handling, viewport screenshot, single-owner detach/close). Selected **`playwright-cdp`** as the default production driver due to zero extra daemon overhead and strict lifecycle lease control.
3. **Phase 2 (Cost-Efficient Decision Loop & Jev Protocol Conformance):** Developed `StructuredActionSelector` providing deterministic element grounding for Chinese structured models (DeepSeek, Qwen) and `JevUltrafastAdapter` adhering strictly to `03_JEV_TEST_PROTOCOL.md` across 14 invariants (J01–J14). Verified zero credential leakage across prompts/payloads, and established `NOT_TESTED` live reporting status when hosted keys are absent.
4. **Phase 3 (Search, Readability & Document Engines):** Added `SearxngWebProvider` supporting JSON results, unresponsive engine failover, and lightweight Readability fallback. Embedded Thai fonts (`DejaVuSans`, `NotoSansThai`) and 2D math layout in `document-renderer.ts`, passing all 20/20 document tests with independent parser validation.
5. **Phase 4 & 5 (Self-Test Regression & Jules QA Handoff):** Executed targeted test suites (95/95 tests passed, 0 failures), synced changes between local environment and Oracle staging VM, and prepared portable QA reproduction manifests.

---

## 2. Pinned Versions & Runtime Requirements

| Dependency / Runtime | Pinned Version | Scope / Notes |
| :--- | :--- | :--- |
| **Node.js** | `v24.18.1` (x64) | Host execution via Cursor helper runtime & Docker containers |
| **Vitest** | `v4.1.11` | Monorepo test runner (`node_modules/vitest/vitest.mjs`) |
| **pnpm** | `v9.15.0` | Monorepo package manager (inside Docker container & host) |
| **Python** | `v3.12.10` (x64) | Grader oracle & independent test harness |
| **pypdf** | `v6.20.1` | Independent structural PDF validation library |
| **Docker Compose** | `v2.x` | Production & staging service orchestration on Oracle VM |
| **PostgreSQL** | `16-alpine` | Dedicated state database container (`rakazo-postgres-1`) |

### Font Asset Pinned Hashes
The following font files are bundled in `packages/adapters/src/fonts/` for Thai rendering and mathematical formulas:
- `DejaVuSans.ttf`: `7ec33fa58a43254ec32b9c5bfb42ef3a6bb5c34e7bbcfbcf8f8444a037885b57` (757,076 bytes)
- `NotoSansThai-Regular.ttf`: `622d9bfe66a4bc275469fa77239efeeebdfbc508ffb8f722a42dd650207ffea9` (274,048 bytes)
- `NotoSansThai-Bold.ttf`: `6739818816cbe62426210f0f42df64205aa804c81889fc683a38cb62f0ba1517` (273,200 bytes)

---

## 3. Implementation File Manifest & SHA-256 Checksums

### A. Core Adapter Implementation & Integration
| Relative Path | Status | SHA-256 Hash | Purpose |
| :--- | :---: | :--- | :--- |
| `packages/adapters/src/browser-provider-spike.ts` | **NEW** | `11D3D140B961BAE1CD24B153E9A5C59DE3AF771E39C1B7A0D2E9BD250F930E70` | Unified spike driver for `playwright-cdp` & `agent-browser` with F1–F8 conformance |
| `packages/adapters/src/browser-provider-spike.test.ts` | **NEW** | `2CF915F5E8789DE51C30954AD9A80AA2AA88152B766AFF6D34E6773A4D881EBA` | 16 unit/contract tests across F1–F8 fixtures for both browser protocols |
| `packages/adapters/src/browser-provider-factory.ts` | **MOD** | `E9CFD39CD0879FE17C4D6FED8B39356354A34040A2787C84EDF040F605293376` | Resolves `"playwright-cdp"` and `"agent-browser"` provider kinds |
| `packages/adapters/src/structured-action-selector.ts` | **NEW** | `20AD2A7214C994A849D0CC64AFA728A824BFB72F0AEA446AB778064C6E698B99` | Structured candidate generation and output parser for DeepSeek/Qwen models |
| `packages/adapters/src/jev-adapter.ts` | **NEW** | `5B3DABD8D6BD37285B4BCA1B0CF436D3E5B272693B438E45503E0A666B59C2CA` | Jev Ultrafast Decision Adapter adhering to `03_JEV_TEST_PROTOCOL.md` |
| `packages/adapters/src/jev-selector.test.ts` | **NEW** | `1DF90FAAC72F521FBA386DBC03DDC15DFFA852B23AA2AA905688C4886B1A2E8B` | 14 invariant tests verifying J01–J14 protocol specifications |
| `packages/adapters/src/searxng-web-search.ts` | **NEW** | `023974DB93C64F76F356E64660D2597E9A1F23572BB3DB0FA93CF956CE032CF1` | SearXNG backend provider with JSON formatting and Readability fallback |
| `packages/adapters/src/searxng-web-search.test.ts` | **NEW** | `FC4B92883D970A4EF5FB974B64DDB4EAA26677FE2C1EC37534DDEAD9F0442B4A` | 5 unit tests for SearXNG results clamping, error tolerance, fallback |
| `packages/adapters/src/web-provider-factory.ts` | **MOD** | `9DF3EB842B4002D9658AC59EA5B58FE7893126E33DC5E606D8006134C3332603` | Resolves `"searxng"` web provider kind via environment `WEB_PROVIDER=searxng` |
| `packages/adapters/src/document-renderer.ts` | **NEW** | `3BF8089C03E52EC6A1B0D8595604132AEE5FAE03D25F31DAD77FA2C6A7F02B90` | Document renderer with DejaVu + NotoSansThai font embedding, math layout |
| `packages/adapters/src/round3-docs-renderer.test.ts` | **NEW** | `E4A2F3116FD56D3632E883A87116B04DA0BF24ED6FFD73618E3CA896C829E6A3` | 20 independent tests for Thai, math formatting, and PDF structure |

### B. Grader Oracle & Verification Harness
| Relative Path | Status | SHA-256 Hash | Purpose |
| :--- | :---: | :--- | :--- |
| `work/after-d-r4-20261014/run-round3-live.py` | **MOD** | `C36F933E5A8C7CBEBEE7BBFB2A66449E6F7C3BB8AC54CDB1D753701E4D46408B` | Hardened live grader evaluation logic with strict hostname/PDF/status checks |
| `work/d-r3-20261014/test_grader_invariants.py` | **MOD** | `A1EB76D491A69A058A242E4894B3382EAF9A2A375F0C6D3E8C275486D6A6717D` | 12 negative mutations (6 Codex + 6 D) + 6 positive invariant suite |
| `work/after-d-r4-20261014/probe-new-mutations.py` | **MOD** | `29EA3CF8BFB1D375C53F82CA919E329C143E0BA243D5EF7B7C9BCF98C87A355A` | 10 new R4 mutations probe yielding `falsePositiveCount: 0` |

---

## 4. Rollback & Disaster Recovery Procedure

To ensure operational stability and protect user assets (including PostgreSQL database records, persistent routines, user vaults, encrypted credentials, and existing desktop containers), follow this precise rollback procedure if any regression is encountered:

### Rollback Principle
All architectural changes were intentionally implemented as **non-destructive, pluggable adapter implementations** registered through factory providers (`resolveBrowserProviderKind`, `resolveWebProviderKind`). Reverting to standard baseline behavior requires only changing configuration environment variables or pulling the original factory files.

### Step-by-Step Rollback

#### Step 1: Revert Provider Configuration
If the new browser driver or search engine exhibits unexpected behavior in staging or production:
1. Set the browser provider back to standard computer mode:
   ```bash
   export BROWSER_PROVIDER=computer
   ```
2. Set the web search provider back to standard keyless HTTP mode:
   ```bash
   export WEB_PROVIDER=keyless-http
   ```
3. Restart the worker service without touching the database:
   ```bash
   sudo docker compose -f infra/compose/docker-compose.tailnet.yml restart rakazo-worker
   ```

#### Step 2: Code-Level Reversion (Git Worktree Safe)
If rolling back the codebase entirely to the pre-spike commit:
1. Discard modified factory files:
   ```bash
   git checkout packages/adapters/src/browser-provider-factory.ts
   git checkout packages/adapters/src/web-provider-factory.ts
   ```
2. The newly added adapter files (`browser-provider-spike.ts`, `jev-adapter.ts`, `searxng-web-search.ts`, `document-renderer.ts`) are inert modules that do not execute unless explicitly registered in the factory. They may remain on disk or be removed safely.

#### Step 3: Safeguard User Data & Storage
- **DO NOT** execute `docker compose down -v` under any circumstances.
- Volume `rakazo_appdata` contains all persistent routines, session transcripts, and artifact links.
- Database container `rakazo-postgres-1` must remain unmolested. No database schema migrations were applied or required by these adapter enhancements.
- Desktop container `/rakazo-computer` (container ID `cdbc74ba0a59`) runs independently on port 16080 and is completely isolated from adapter updates.

---

## 5. Verification Commands for Rollback Validation

To verify that the system is operating cleanly post-rollback:
```bash
# Verify factory defaults
pnpm --filter @rakazo/adapters test packages/adapters/src/keyless-http-web.test.ts
pnpm --filter @rakazo/adapters test packages/adapters/src/computer-browser.test.ts

# Confirm database connectivity
sudo docker exec rakazo-api-1 curl -sf http://127.0.0.1:3100/health
```
