import logging
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.health import router as health_router
from app.routes.analyze import router as analyze_router
from app.routes.report import router as report_router
from app.errors import register_error_handlers
from app.config import settings

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# App
app = FastAPI(
    title="Expense AI Service",
    version="1.0.0",
    description="Anomaly detection and report generation for expense management",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# Register error handlers before routes
register_error_handlers(app)

# Register routes
app.include_router(health_router)
app.include_router(analyze_router)
app.include_router(report_router)


@app.on_event("startup")
async def startup() -> None:
    logger.info(f"AI service starting on port {settings.ai_service_port}")
    logger.info(f"Using model: {settings.groq_model}")


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.ai_service_port,
        reload=True,
    )
