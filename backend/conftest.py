"""Root conftest — ensures tests always run against in-memory repos."""

import os

# Force in-memory repos regardless of .env contents.
# Must be set BEFORE any app module is imported.
os.environ["USE_MEMORY_REPOS"] = "true"
