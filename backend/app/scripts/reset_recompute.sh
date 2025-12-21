#!/usr/bin/env bash
# Run inside the backend container to reset tables, refetch data, and recompute arbitrage.

set -euo pipefail

cd /code

echo "Waiting for database to be ready..."
echo "Dropping and recreating tables..."
python - <<'PY'
from app.database import Base, engine
from app import models  # noqa: F401 - ensure metadata is populated

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
print("Tables reset.")
PY

echo "Fetching fresh data..."
python -m app.scripts.fetch_data

echo "Computing minute-level arbitrage opportunities..."
python -m app.scripts.compute_opportunities

echo "Computing non-atomic arbitrage candidates..."
python -m app.scripts.compute_arbitrage

echo "All steps completed."
