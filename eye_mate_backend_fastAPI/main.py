"""
EyeMate Backend FastAPI Application
Refactored to follow MVC (Model-View-Controller) pattern
"""

from app.app import app
from app.config import settings

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.HOST, port=settings.PORT)