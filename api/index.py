import sys
import os
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app import app

# Vercel serverless handler
def handler(request):
    """Handle Vercel serverless requests"""
    return app(request)
