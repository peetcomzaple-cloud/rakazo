# Jules Independent QA Report: VM01-VM12 Update

**Date:** 2026-10-16
**Baseline Commit:** `rakazo-repair-oct16`
**Environment:** Offline AST and Vitest

This report supplements the earlier acceptance report based on the updated requirements (VM01-VM12) regarding the computer sandbox, execution jobs, and environment constraints.

## Proposed VM Tests Status

As noted in the earlier report, the current adapter implementation (`packages/adapters/src/computer-tools.ts`) is missing several critical functions, which breaks the test harness and prevents a meaningful execution of the UI smoke tests or active soak. Therefore, the VM tests are in the **BLOCKED / NOT_TESTED** state until the foundational issues are resolved.

| Test Case | Description | Status | Reason |
| :--- | :--- | :--- | :--- |
| **VM01** | Script success, nonzero exit, and timeout are clearly separated with actual UI file verification. | BLOCKED | Test harness blocked by missing adapter functions. |
| **VM02** | Stop action ends all child/grandchild processes. No orphaned/zombie processes remain. | BLOCKED | Test harness blocked. |
| **VM03** | Stop action after job finishes, or late callbacks do not affect reused PIDs or new jobs. | BLOCKED | Test harness blocked. |
| **VM04** | stdout/stderr floods are bounded by memory/log caps and properly truncated. | BLOCKED | Test harness blocked. |
| **VM05** | Reconnects access the original job; closing the viewer does not spawn new jobs/browsers. | BLOCKED | Test harness blocked. |
| **VM06** | Dependency caching works per job; missing cache offline reports accurately. | BLOCKED | Test harness blocked. |
| **VM07** | Resource exhaustion (OOM, timeout) in disposable containers is properly restricted and reported. | BLOCKED | Test harness blocked. |
| **VM08** | Workspace constraints (dot listing, path traversal, symlink escapes) are correctly sandboxed. | BLOCKED | Test harness blocked. |
| **VM09** | Wrong displays, stale coordinates/targets are rejected before input dispatch. | BLOCKED | Test harness blocked. |
| **VM10** | Video recordings are properly validated for dynamic content/liveness and pixel variance. | BLOCKED | Test harness blocked. |
| **VM11** | Missing or incompatible binaries result in bounded recovery, not infinite installation loops. | BLOCKED | Test harness blocked. |
| **VM12** | Missing window inventory/status does not erroneously return verified closed. | BLOCKED | Test harness blocked; current helper probe incorrectly returns true when inventory is missing. |

## Open Source Review Insights
The independent review of open-source tools (Tini, psutil, uv, noVNC, nbclient, Xpra, Bubblewrap) highlighted potential avenues for improving process management, environment isolation, and viewer robustness. However, integration of these tools must be done carefully, adhering to existing security boundaries and licensing constraints (e.g., avoiding GPL contamination where non-commercial clauses apply). Currently, no code from these projects has been incorporated or tested in the provided build.

## Next Steps
The development team must prioritize fixing the `TypeError` issues in the test suites (by implementing the missing methods in `packages/adapters/src/computer-tools.ts`). Once the core adapters and unit tests pass, we can proceed with executing the proposed VM01-VM12 test cases in the disposable staging environment and moving towards UI acceptance and active soak testing.
