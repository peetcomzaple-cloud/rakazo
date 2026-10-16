# Bug Reports / Fix Requests for Antigravity

## 1. Missing Implementations in `computer-tools.ts`
**Impact:** 45 tests failing across multiple Vitest suites.
**Location:** `packages/adapters/src/computer-tools.ts`
**Issue:** Several functions are imported by the test files but are not implemented/exported in `computer-tools.ts`.

Missing functions include:
- `isWindowClosed`
- `verifyWindowCloseEvidence`
- `sanitizeScreenIdentity`
- `isPointerClickAction`
- `isKeyboardSubmitAction`
- `isWindowCloseAction`
- `isSameScreenGeneration`

**Evidence:**
- Vitest throws `TypeError: <function> is not a function` for all the above methods. (See `failures/VITEST_FAILURES.md`)
- `git log -p -n 1 -- packages/adapters/src/computer-tools.ts` confirms the functions were never introduced in the latest patch by Antigravity.

## 2. Invalid Dummy PDF Byte Padding in Grader Invariants
**Impact:** The verified positive `doc-pdf` case is rejected (1 failure out of 6 positive cases)
**Location:** `work/d-r3-20261014/test_grader_invariants.py` and `work/after-d-r4-20261014/probe-new-mutations.py`
**Issue:** The test generates `valid_pdf_padded = valid_pdf_content + b' ' * 1000 + b'\n%%EOF'`. However, `pypdf`'s strict parsing throws `Duplicate %%EOF marker(s) found, skipping them` and `incorrect startxref pointer(1)`, failing the PDF validation. This causes the test to fail.
