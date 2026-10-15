#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "  Rakazo Architecture: Jules Local Independent QA Runner"
echo "=========================================================="

# 1. Verify environment
echo "[1/4] Checking environment..."
echo "Node: $(node -v 2>/dev/null || echo 'NOT FOUND')"
echo "Python: $(python3 --version 2>/dev/null || echo 'NOT FOUND')"

# 2. Run Python Grader Invariants
echo ""
echo "[2/4] Running Python Grader Invariants..."
if command -v python3 &>/dev/null; then
  python3 work/d-r3-20261014/test_grader_invariants.py
  python3 work/after-d-r4-20261014/probe-new-mutations.py
else
  echo "WARNING: python3 not found, skipping Python grader tests."
fi

# 3. Run Core Architecture Vitest Suites
echo ""
echo "[3/4] Running Core Architecture Adapter Suites..."
if command -v npx &>/dev/null; then
  npx vitest run \
    packages/adapters/src/browser-provider-spike.test.ts \
    packages/adapters/src/jev-selector.test.ts \
    packages/adapters/src/searxng-web-search.test.ts \
    packages/adapters/src/round3-docs-renderer.test.ts
else
  echo "WARNING: npx not found, skipping vitest suites."
fi

# 4. Run Companion Browser & Regression Suites
echo ""
echo "[4/4] Running Companion Browser & Web Suites..."
if command -v npx &>/dev/null; then
  npx vitest run \
    packages/adapters/src/keyless-http-web.test.ts \
    packages/adapters/src/computer-browser.test.ts \
    packages/adapters/src/browser-tools.test.ts \
    packages/adapters/src/browser-conformance.test.ts \
    packages/adapters/src/jev-benchmark.test.ts
fi

echo ""
echo "=========================================================="
echo "  ALL LOCAL QA VERIFICATION SUITES COMPLETED"
echo "=========================================================="
