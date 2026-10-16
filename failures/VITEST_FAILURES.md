# Vitest Failures Report

Several tests in the adapter suites failed because of missing or incorrectly implemented functions in the product source code.
Specifically, `packages/adapters/src/computer-tools.ts` is missing functions imported by the test files, or the test files are referencing functions that have not been correctly implemented.

## Summary of Failing Suites
- `packages/adapters/src/round3-screen-lifecycle.test.ts`: 14 tests failed
- `packages/adapters/src/page-browser-helper.test.ts`: 2 tests failed
- `packages/adapters/src/round2-page-browser.test.ts`: 8 tests failed
- `packages/adapters/src/computer-coordinate-bounds.test.ts`: 15 tests failed
- `packages/adapters/src/action-approval-autonomous.test.ts`: 4 tests failed
- `packages/adapters/src/docker-files.test.ts`: 2 tests failed

## Root Cause Examples
**TypeError: isWindowClosed is not a function**
```
❯ packages/adapters/src/round3-screen-lifecycle.test.ts:80:14
     78|         windows: [],
     79|       };
     80|       expect(isWindowClosed(targetWid, obsEmpty as ExtendedComputerObservation)).toBe(true);
```

**TypeError: verifyWindowCloseEvidence is not a function**
```
❯ packages/adapters/src/round3-screen-lifecycle.test.ts:121:22
    119|       };
    120|
    121|       const result = verifyWindowCloseEvidence({
```

**TypeError: sanitizeScreenIdentity is not a function**
```
❯ packages/adapters/src/round3-screen-lifecycle.test.ts:219:25
    217|       };
    218|
    219|       const sanitized = sanitizeScreenIdentity(rawIdentity);
```

**Other missing functions:**
- `isSameScreenGeneration`
- `isPointerClickAction`
- `isKeyboardSubmitAction`
- `isWindowCloseAction`

The file `packages/adapters/src/computer-tools.ts` does not export these functions, leading to test crashes.
