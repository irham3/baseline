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


class GoogleAuthBody(BaseModel):
    credential: Optional[str] = None
    session_id: Optional[str] = None
    access_token: Optional[str] = None


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
    # Only a reference and editable, non-numeric copy are trusted from the browser.
    # The backend looks up the actual price/quantity/timeline from the server-stored
    # analysis by option_id -- the client can never supply numeric deal terms directly.
    option_id: str = Field(min_length=1, max_length=10)
    project_title: str = Field(min_length=1, max_length=200)
    client_name: Optional[str] = Field(default=None, max_length=200)


class AgreementResponseBody(BaseModel):
    action: str
    message: Optional[str] = Field(default=None, max_length=2000)


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
