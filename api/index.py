import sys
import os
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app import app

# Vercel serverless WSGI handler
def handler(request):
    """WSGI handler for Vercel serverless functions"""
    return app(request)

# Also export app directly for compatibility
__all__ = ["app"]
