"""Pydantic request bodies for Baseline routers."""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field, EmailStr


class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: Optional[str] = None


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionBody(BaseModel):
    session_id: str


class AnalyzeBody(BaseModel):
    brief: str
    redact: bool = False
    use_ai: bool = True


class CostProfileBody(BaseModel):
    mode: str = "guided"
    target_take_home: Optional[float] = None
    monthly_overhead: Optional[float] = None
    monthly_reserve: Optional[float] = None
    total_working_hours: Optional[float] = None
    billable_utilization: Optional[float] = None
    cost_per_hour: Optional[float] = None
    target_margin: float = 0.20
    save: bool = False


class EstimateBody(BaseModel):
    cost_profile: CostProfileBody
    scope_overrides: dict
    apply_calibration: bool = False


class DealCopyBody(BaseModel):
    scope_overrides: dict
    options: list[dict]


class ScopeCheckBody(BaseModel):
    new_request: str
    delta: Optional[dict] = None
    cost_profile: Optional[CostProfileBody] = None


class AgreementBody(BaseModel):
    option: dict
    project_title: str
    client_name: Optional[str] = None


class AgreementResponseBody(BaseModel):
    action: str
    message: Optional[str] = None


class DemoAgreementBody(BaseModel):
    option_id: str = "B"
    project_title: str = "Campaign 12 Reels - Baseline (demo)"


class ProjectBody(BaseModel):
    project_name: str
    estimated_hours: float
    actual_hours: float
    expected_revisions: int = 0
    actual_revisions: int = 0
    scope_note: Optional[str] = None
    deviation_reason: Optional[str] = None


class AnalyticsBody(BaseModel):
    event: str
    props: dict = Field(default_factory=dict)
