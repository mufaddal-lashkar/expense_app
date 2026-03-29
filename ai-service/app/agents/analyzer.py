import json
import logging
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.exceptions import LangChainException
from app.agents.llm import get_llm
from app.models import AnalyzeRequest, AnalyzeResponse, AnomalyFlag

logger = logging.getLogger(__name__)

# Prompts
SYSTEM_PROMPT = """You are an expense compliance officer AI for a multi-tenant expense management system.

Your job is to analyze a single expense submission and detect:
1. POLICY_VIOLATION — expense violates common company policies (e.g. alcohol, personal items, luxury)
2. HIGH_AMOUNT — amount is unusually high for the category
3. MISSING_INFO — critical information is missing (no merchant, no description for large amounts)
4. SUSPICIOUS_CATEGORY — category does not match description or merchant
5. DUPLICATE_RISK — title/merchant/amount combination looks like it could be a duplicate

You must respond with ONLY valid JSON matching this exact structure — no markdown, no explanation:
{
  "is_anomaly": boolean,
  "flags": [
    {
      "type": "FLAG_TYPE",
      "severity": "low" | "medium" | "high",
      "message": "Clear human-readable explanation"
    }
  ],
  "confidence_score": float between 0.0 and 1.0,
  "recommendation": "approve" | "review" | "reject"
}

Rules:
- is_anomaly is true if ANY flag of medium or high severity is present
- confidence_score reflects how certain you are of your analysis
- recommendation is "approve" if no flags, "review" if low/medium flags, "reject" if high severity flags
- Return empty flags array if no issues found
- Be pragmatic — not every expense is suspicious"""


def build_expense_prompt(req: AnalyzeRequest) -> str:
    return f"""Analyze this expense submission:

Title: {req.title}
Amount: {req.amount} {req.currency}
Category: {req.category.value}
Merchant: {req.merchant_name or "Not provided"}
Description: {req.description or "Not provided"}

Category-based amount guidelines (flag if significantly exceeded):
- meals: $50 typical, $150 high, $300+ suspicious
- travel: $500 typical, $2000 high, $5000+ suspicious  
- accommodation: $200/night typical, $500 high, $1000+ suspicious
- software: $100 typical, $500 high, $2000+ suspicious
- hardware: $500 typical, $2000 high, $5000+ suspicious
- office/other: $100 typical, $500 high, $1000+ suspicious

Respond with JSON only."""


# Main analyzer function
async def analyze_expense(req: AnalyzeRequest) -> AnalyzeResponse:
    """
    Calls the LLM to analyze a single expense for anomalies.
    Returns a structured AnalyzeResponse — never raises to the caller,
    always returns a valid response (safe fallback on error).
    """
    llm = get_llm(temperature=0.1, streaming=False)

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=build_expense_prompt(req)),
    ]

    try:
        response = await llm.ainvoke(messages)
        raw = response.content

        # Strip markdown fences if the model wraps in ```json despite instructions
        if isinstance(raw, str):
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
                raw = raw.strip()

        parsed = json.loads(raw)

        # Validate and coerce via Pydantic
        flags = [AnomalyFlag(**f) for f in parsed.get("flags", [])]
        return AnalyzeResponse(
            is_anomaly=parsed["is_anomaly"],
            flags=flags,
            confidence_score=float(parsed["confidence_score"]),
            recommendation=parsed["recommendation"],
        )

    except (LangChainException, json.JSONDecodeError, KeyError, ValueError) as e:
        # Never crash the backend — return a safe "needs review" response
        logger.error(f"Analyzer error for expense {req.id}: {e}")
        return AnalyzeResponse(
            is_anomaly=False,
            flags=[
                AnomalyFlag(
                    type="ANALYSIS_FAILED",
                    severity="low",
                    message="AI analysis could not be completed. Manual review recommended.",
                )
            ],
            confidence_score=0.0,
            recommendation="review",
        )