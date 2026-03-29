from pydantic import BaseModel, Field
from typing import Literal
from enum import Enum


class ExpenseCategory(str, Enum):
    travel = "travel"
    meals = "meals"
    accommodation = "accommodation"
    software = "software"
    hardware = "hardware"
    office = "office"
    marketing = "marketing"
    training = "training"
    other = "other"


class ExpenseStatus(str, Enum):
    draft = "draft"
    submitted = "submitted"
    approved = "approved"
    rejected = "rejected"
    reimbursed = "reimbursed"


# Analyze endpoint
class AnalyzeRequest(BaseModel):
    id: str
    title: str
    amount: float
    currency: str = "USD"
    category: ExpenseCategory
    merchant_name: str | None = None
    description: str | None = None
    organization_id: str 


class AnomalyFlag(BaseModel):
    type: str = Field(description="Short flag type e.g. DUPLICATE, POLICY_VIOLATION, HIGH_AMOUNT")
    severity: Literal["low", "medium", "high"]
    message: str = Field(description="Human readable explanation")


class AnalyzeResponse(BaseModel):
    is_anomaly: bool
    flags: list[AnomalyFlag]
    confidence_score: float = Field(ge=0.0, le=1.0)
    recommendation: Literal["approve", "review", "reject"]


# Report endpoint
class ReportExpense(BaseModel):
    id: str
    title: str
    amount: float
    currency: str = "USD"
    category: ExpenseCategory
    status: ExpenseStatus
    merchant_name: str | None = None
    ai_flags: dict | None = None


class ReportRequest(BaseModel):
    month: str = Field(description="YYYY-MM format")
    expenses: list[ReportExpense]


# SSE chunk 
class SSEChunk(BaseModel):
    text: str
    done: bool = False