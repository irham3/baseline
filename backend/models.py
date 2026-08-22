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


# Max length for a pasted client brief -- generous for a WhatsApp chat dump, but bounded.
MAX_BRIEF_LENGTH = 6000


class AnalyzeBody(BaseModel):
    brief: str = Field(max_length=MAX_BRIEF_LENGTH)
    redact: bool = False
    use_ai: bool = True


class CostProfileBody(BaseModel):
    mode: str = "guided"
    target_take_home: Optional[float] = Field(default=None, ge=0, le=1_000_000_000)
    monthly_overhead: Optional[float] = Field(default=None, ge=0, le=1_000_000_000)
    monthly_reserve: Optional[float] = Field(default=None, ge=0, le=1_000_000_000)
    total_working_hours: Optional[float] = Field(default=None, gt=0, le=744)
    billable_utilization: Optional[float] = Field(default=None, gt=0, le=1)
    cost_per_hour: Optional[float] = Field(default=None, ge=0, le=100_000_000)
    target_margin: float = Field(default=0.20, ge=0, lt=1)
    save: bool = False


class EstimateBody(BaseModel):
    cost_profile: CostProfileBody
    scope_overrides: dict
    apply_calibration: bool = False


class DealCopyBody(BaseModel):
    scope_overrides: dict
    options: list[dict] = Field(min_length=2, max_length=3)


class ProfessionOverrideBody(BaseModel):
    profession: str = Field(min_length=1, max_length=50)


class ScopeCheckBody(BaseModel):
    new_request: str = Field(min_length=1, max_length=2000)
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
    project_name: str = Field(min_length=1, max_length=200)
    estimated_hours: float = Field(gt=0, le=10_000)
    actual_hours: float = Field(gt=0, le=10_000)
    expected_revisions: int = Field(default=0, ge=0, le=1000)
    actual_revisions: int = Field(default=0, ge=0, le=1000)
    scope_note: Optional[str] = Field(default=None, max_length=1000)
    deviation_reason: Optional[str] = Field(default=None, max_length=1000)


class AnalyticsBody(BaseModel):
    event: str = Field(min_length=1, max_length=64)
    props: dict = Field(default_factory=dict)
