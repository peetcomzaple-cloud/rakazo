# Failing Production Import Tests / Adapters Verification

**Baseline Commit:** `67f37b16dc3c00584ac28bbdb1871e658e9516ff`

**Command Ran:** `pnpm run check --filter @rakazo/adapters`

**Results:**
No codebase patches were applied (as instructed) to `packages/adapters/src/executor.ts`. The errors represent genuine integration gaps between the newly introduced spikes/interfaces and the actual `executor` code.

**Exit Code:** `1`

**Key Missing Exports & Mismatches (Production Verifications):**
```
@rakazo/adapters:check: src/executor.ts(5114,42): error TS2339: Property 'windowInventoryStatus' does not exist on type 'ComputerObservation'.
@rakazo/adapters:check: src/executor.ts(5137,62): error TS2339: Property 'windows' does not exist on type 'ComputerObservation'.
@rakazo/adapters:check: src/executor.ts(5148,40): error TS2339: Property 'unchangedScreen' does not exist on type 'ComputerObservation'.
@rakazo/adapters:check: src/executor.ts(6173,52): error TS2339: Property 'verified' does not exist on type '{ ok?: boolean | undefined; url?: string | undefined; title?: string | undefined; completed?: number | undefined; error?: string | undefined; noOp?: boolean | undefined; stateChanged?: boolean | undefined; isModal?: boolean | undefined; activeModal?: string | undefined; }'.
@rakazo/adapters:check: src/executor.ts(7313,36): error TS2552: Cannot find name 'loadReplyContext'. Did you mean 'replyContext'?
@rakazo/adapters:check: src/executor.ts(7555,19): error TS2353: Object literal may only specify known properties, and 'fallbackOnReadToolError' does not exist in type 'AgentRunRequest'.
@rakazo/adapters:check: src/executor.ts(7660,39): error TS2552: Cannot find name 'loadReplyContext'. Did you mean 'replyContext'?
```

### Action Taken
- Listed missing bounds and properties inside `BLOCKED_RECHECK.md`.
- No forced overrides or mock scripts were created to falsely resolve these.
