from fastapi import APIRouter
from app.models import AnalyzeRequest, AnalyzeResponse
from app.agents.analyzer import analyze_expense

router = APIRouter()


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_endpoint(req: AnalyzeRequest) -> AnalyzeResponse:
    """
    Accepts a single expense and returns structured anomaly analysis.
    Never raises — analyzer handles all errors internally and returns
    a safe fallback response.
    """
    return await analyze_expense(req)