#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== RoadSafe Test Suite ==="

# ─── Determine execution mode ────────────────────────────────────────────────
# If the backend service is running in Docker, execute tests inside containers.
# Otherwise fall back to local execution (requires pre-installed node_modules).

if docker compose ps --status running backend 2>/dev/null | grep -q backend; then
  echo "Detected running Docker environment — executing tests in containers."

  echo "[1/3] Running backend unit tests (Docker)"
  docker compose exec -T backend node --test ../unit_tests/*.test.js

  echo "[2/3] Running API integration tests (Docker)"
  docker compose exec -T backend node --test ../API_tests/*.test.js

  echo "[3/3] Running frontend structural tests (local — static analysis only)"
  (
    cd "$SCRIPT_DIR/frontend"
    node --test tests/ui.test.js
  )

  # Run vitest component tests if available
  if [ -f "$SCRIPT_DIR/frontend/vitest.config.js" ] && [ -d "$SCRIPT_DIR/frontend/node_modules/.bin" ]; then
    echo "[4/4] Running frontend component tests (vitest)"
    (
      cd "$SCRIPT_DIR/frontend"
      npx vitest run --config vitest.config.js
    )
  fi

else
  echo "No Docker environment detected — running tests locally."
  echo "Ensure backend/node_modules and frontend/node_modules are installed."

  if [ ! -d "$SCRIPT_DIR/backend/node_modules" ]; then
    echo "ERROR: backend/node_modules not found. Run 'npm install' in backend/ first." >&2
    exit 1
  fi

  echo "[1/3] Running backend unit tests"
  (
    cd "$SCRIPT_DIR/backend"
    node --test ../unit_tests/*.test.js
  )

  echo "[2/3] Running API integration tests"
  (
    cd "$SCRIPT_DIR/backend"
    node --test ../API_tests/*.test.js
  )

  echo "[3/3] Running frontend tests"
  (
    cd "$SCRIPT_DIR/frontend"
    node --test tests/ui.test.js
  )

  if [ -f "$SCRIPT_DIR/frontend/vitest.config.js" ] && [ -d "$SCRIPT_DIR/frontend/node_modules/.bin" ]; then
    echo "[4/4] Running frontend component tests (vitest)"
    (
      cd "$SCRIPT_DIR/frontend"
      npx vitest run --config vitest.config.js
    )
  fi
fi

# Optional: Run E2E browser tests if Playwright is installed
if [ -f "$SCRIPT_DIR/frontend/playwright.config.js" ] && command -v npx &>/dev/null; then
  if [ -n "${E2E_BASE_URL:-}" ]; then
    echo "[E2E] Running Playwright browser tests"
    (
      cd "$SCRIPT_DIR/frontend"
      E2E_BASE_URL="$E2E_BASE_URL" npx playwright test --config playwright.config.js
    )
  else
    echo "[E2E] Skipping Playwright tests (set E2E_BASE_URL to enable)"
  fi
fi

echo "=== All tests passed ==="
