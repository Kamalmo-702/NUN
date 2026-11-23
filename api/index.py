"""Vercel serverless entrypoint. Vercel looks for an ASGI object named `app` here."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.api import app  # noqa: E402,F401
