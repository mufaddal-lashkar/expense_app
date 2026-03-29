import logging
from typing import AsyncGenerator
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.exceptions import LangChainException
from app.agents.llm import get_llm
from app.models import ReportRequest

logger = logging.getLogger(__name__)

# Prompts

SYSTEM_PROMPT = """You are a financial analyst AI generating monthly expense reports for organizations.

Write a clear, structured markdown report covering:
1. Executive Summary — total spend, number of expenses, approval rate
2. Spending by Category — breakdown with amounts and percentages  
3. Top Expenses — the 5 highest individual expenses
4. Flagged Items — any expenses with AI anomaly flags
5. Trends & Observations — patterns, concerns, recommendations

Use markdown formatting with headers, bullet points, and bold for key numbers.
Be concise but thorough. Use the actual data provided — never fabricate numbers."""


def build_report_prompt(req: ReportRequest) -> str:
    if not req.expenses:
        return f"Generate a report for {req.month} noting that no relevant expenses were found for this period."

    # Build expense summary for the prompt
    approved_expenses = [e for e in req.expenses if e.status.value in ["approved", "reimbursed"]]
    submitted_expenses = [e for e in req.expenses if e.status.value == "submitted"]
    rejected_expenses = [e for e in req.expenses if e.status.value == "rejected"]
    
    total_approved_spend = sum(e.amount for e in approved_expenses)
    total_count = len(req.expenses)
    # Approval rate = (Approved + Reimbursed) / Total (Non-Draft)
    approval_rate = (len(approved_expenses) / total_count * 100) if total_count > 0 else 0

    by_category: dict[str, float] = {}
    flagged = []

    for e in req.expenses:
        if e.status.value in ["approved", "reimbursed"]:
            by_category[e.category.value] = by_category.get(e.category.value, 0) + e.amount
        if e.ai_flags and e.ai_flags.get("is_anomaly") or e.ai_flags and e.ai_flags.get("isAnomaly"):
            flagged.append(e)

    # Sort categories by spend
    sorted_cats = sorted(by_category.items(), key=lambda x: x[1], reverse=True)
    # Top 5 by amount (approved ones)
    top_expenses = sorted(approved_expenses, key=lambda e: e.amount, reverse=True)[:5]

    prompt = f"""Generate a monthly expense report for: {req.month}

SUMMARY DATA:
- Total expenses (non-draft): {total_count}
- Approved/Reimbursed: {len(approved_expenses)}
- Pending Review: {len(submitted_expenses)}
- Rejected: {len(rejected_expenses)}
- Approval Rate: {approval_rate:.1f}%
- Total approved spend: ${total_approved_spend:,.2f}
- Flagged by AI Anomaly Detection: {len(flagged)}

SPENDING BY CATEGORY (Approved Only):
{chr(10).join(f"- {cat}: ${amt:,.2f} ({(amt/total_approved_spend*100):.1f}%)" for cat, amt in sorted_cats) if total_approved_spend > 0 else "No approved spending."}

TOP 5 APPROVED EXPENSES:
{chr(10).join(f"- {e.title} ({e.category.value}): ${e.amount:,.2f}" + (f" [by {e.merchant_name}]" if e.merchant_name else "") for e in top_expenses) if top_expenses else "None"}

FLAGGED EXPENSES ({len(flagged)}):
{chr(10).join(f"- {e.title} ({e.status.value}): ${e.amount:,.2f}" for e in flagged) if flagged else "None"}

Write the full markdown report now."""

    return prompt


# Streaming generator
async def stream_report(req: ReportRequest) -> AsyncGenerator[str, None]:
    """
    Streams the monthly report using LangChain's astream().
    Yields raw text chunks — the route handler wraps them in SSE format.
    On error mid-stream, yields an error message chunk then stops.
    """
    llm = get_llm(temperature=0.3, streaming=True)

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=build_report_prompt(req)),
    ]

    try:
        async for chunk in llm.astream(messages):
            # chunk.content can be a string or list depending on model
            if isinstance(chunk.content, str) and chunk.content:
                yield chunk.content
            elif isinstance(chunk.content, list):
                for part in chunk.content:
                    if isinstance(part, dict) and part.get("type") == "text":
                        yield part.get("text", "")

    except LangChainException as e:
        logger.error(f"Report streaming error: {e}")
        yield f"\n\n⚠️ Report generation encountered an error: {str(e)}"

    except Exception as e:
        logger.error(f"Unexpected streaming error: {e}")
        yield "\n\n⚠️ An unexpected error occurred during report generation."