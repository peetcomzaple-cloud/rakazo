# Jules Independent QA Results

## Scope

The following checks were performed against `a36a011d3c3e5f9abe735288af7bd6307e12f840`:
1. **web_fetch batch**: PASS. `packages/adapters/src/keyless-http-web.test.ts` successfully verified that `web_fetch` handles multiple concurrent URLs, isolates mixed failures, enforces output caps (50k chars), and honors abort signals without taking down the entire batch.
2. **TOTP/SSO**: PASS. `packages/adapters/src/browser-tools.test.ts` verified that `fill_secret` now correctly routes `totp` schemas, generates RFC 6238 Base32 codes deterministicly, and strictly enforces origin allowlists to prevent SSO token leaks.
3. **Browser Evidence (click_selector)**: PASS. In `packages/adapters/src/round2-page-browser.test.ts` and `browser-provider-spike.test.ts`, the actor correctly requires DOM verification. Fake DOM tokens/events missing in snapshots are blocked.
4. **Downloads**: PASS. Handled in `computer-browser.test.ts` & box sandbox integration test where download receipts verify sizes and enforce a bounded streaming cap (50MB). Files are correctly scoped.
5. **JSON Harvester**: PASS. XHR buffers successfully truncate over output caps, and tests confirm sessions don't bleed buffers.
6. **Linux container/CLI integration**: INCONCLUSIVE/NOT_TESTED. Real disposable CLI environments with live OCR and video/audio dependencies are outside the scope of isolated snapshot tests on this container. Verified strictly using offline mocks.
7. **Regression safety**: PASS. The standard regression suite (100 tests) passed cleanly.

Overall Acceptance: PENDING LIVE SOAK AND REAL BROWSER (NOT_TESTED).

## Details

- **Git Branch:** `qa-next-gen-review`
- **Pinned HEAD Commit:** `a36a011d3c3e5f9abe735288af7bd6307e12f840`
- **OS:** Linux x86_64
