from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field, model_validator


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    display_name: str = Field(..., min_length=1, max_length=100)

    model_config = {"str_strip_whitespace": True}


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    model_config = {"str_strip_whitespace": True}


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str
    preferred_unit: str
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdateRequest(BaseModel):
    display_name: str | None = None
    preferred_unit: str | None = None  # 'kg' or 'lbs'


# ---------------------------------------------------------------------------
# Message
# ---------------------------------------------------------------------------


class MessageResponse(BaseModel):
    message: str


# ---------------------------------------------------------------------------
# Exercise schemas
# ---------------------------------------------------------------------------


class SubstitutionCreate(BaseModel):
    substitute_exercise_id: str
    priority: int = Field(..., ge=1)


class SubstitutionResponse(BaseModel):
    id: str
    substitute_exercise_id: str
    substitute_exercise_name: str | None = None
    priority: int

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def extract_substitute_name(cls, data: object) -> object:
        """Pull the substitute exercise name from the loaded relationship."""
        if hasattr(data, "substitute_exercise") and data.substitute_exercise:
            data.substitute_exercise_name = data.substitute_exercise.name  # type: ignore[union-attr]
        return data


class ExerciseCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    muscle_group: str = Field(..., min_length=1, max_length=100)
    equipment: str | None = None
    youtube_url: str | None = None
    notes: str | None = None


class ExerciseResponse(BaseModel):
    id: str
    name: str
    muscle_group: str
    equipment: str | None = None
    is_custom: bool
    youtube_url: str | None = None
    notes: str | None = None
    created_at: datetime
    substitutions: list[SubstitutionResponse] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Template schemas
# ---------------------------------------------------------------------------


class TemplateExerciseCreate(BaseModel):
    exercise_id: str
    week_type: str = Field(..., min_length=1, max_length=20)
    order: int = Field(..., ge=0)
    working_sets: int = Field(..., ge=1)
    min_reps: int = Field(..., ge=1)
    max_reps: int = Field(..., ge=1)
    early_set_rpe_min: Decimal = Field(..., ge=1, le=10)
    early_set_rpe_max: Decimal = Field(..., ge=1, le=10)
    last_set_rpe_min: Decimal = Field(..., ge=1, le=10)
    last_set_rpe_max: Decimal = Field(..., ge=1, le=10)
    rest_period: str = Field(..., min_length=1, max_length=50)
    intensity_technique: str | None = None
    min_warmup_sets: int = Field(..., ge=0)
    max_warmup_sets: int = Field(..., ge=0)

    @model_validator(mode="after")
    def validate_rep_range(self) -> "TemplateExerciseCreate":
        if self.min_reps > self.max_reps:
            raise ValueError("min_reps must be <= max_reps")
        return self

    @model_validator(mode="after")
    def validate_warmup_range(self) -> "TemplateExerciseCreate":
        if self.min_warmup_sets > self.max_warmup_sets:
            raise ValueError("min_warmup_sets must be <= max_warmup_sets")
        return self


class TemplateExerciseResponse(BaseModel):
    id: str
    exercise_id: str
    week_type: str
    order: int
    working_sets: int
    min_reps: int
    max_reps: int
    early_set_rpe_min: Decimal
    early_set_rpe_max: Decimal
    last_set_rpe_min: Decimal
    last_set_rpe_max: Decimal
    rest_period: str
    intensity_technique: str | None = None
    min_warmup_sets: int
    max_warmup_sets: int

    model_config = {"from_attributes": True}


class TemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    template_exercises: list[TemplateExerciseCreate] = []


class TemplateResponse(BaseModel):
    id: str
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TemplateDetailResponse(BaseModel):
    id: str
    name: str
    created_at: datetime
    template_exercises: list[TemplateExerciseResponse] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Session schemas
# ---------------------------------------------------------------------------


class SetCreate(BaseModel):
    exercise_id: str
    set_type: str = Field(..., min_length=1, max_length=20)
    set_number: int = Field(..., ge=1)
    reps: int = Field(..., ge=0)
    weight: Decimal = Field(..., ge=0)
    rpe: Decimal | None = Field(default=None, ge=1, le=10)
    notes: str | None = None


class SetResponse(BaseModel):
    id: str
    exercise_id: str
    set_type: str
    set_number: int
    reps: int
    weight: Decimal
    rpe: Decimal | None = None
    notes: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SetUpdate(BaseModel):
    reps: int | None = Field(default=None, ge=0)
    weight: Decimal | None = Field(default=None, ge=0)
    rpe: Decimal | None = Field(default=None, ge=1, le=10)
    notes: str | None = None


class SessionCreate(BaseModel):
    template_id: str | None = None
    week_type: str = Field(..., min_length=1, max_length=20)
    year_week: str | None = None


class SessionUpdate(BaseModel):
    finished_at: datetime | None = None
    notes: str | None = None


class SessionResponse(BaseModel):
    id: str
    template_id: str | None = None
    year_week: str | None = None
    week_type: str
    started_at: datetime
    finished_at: datetime | None = None
    notes: str | None = None
    synced: bool

    model_config = {"from_attributes": True}


class SessionDetailResponse(BaseModel):
    id: str
    template_id: str | None = None
    year_week: str | None = None
    week_type: str
    started_at: datetime
    finished_at: datetime | None = None
    notes: str | None = None
    synced: bool
    sets: list[SetResponse] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Progress schemas
# ---------------------------------------------------------------------------


class ProgressResponse(BaseModel):
    year_week: str
    max_weight: Decimal
    warmup_weight_range: str | None = None
    warmup_sets_done: int | None = None

    model_config = {"from_attributes": True}


class VolumeResponse(BaseModel):
    year_week: str
    muscle_group: str
    total_volume: Decimal


class RecordResponse(BaseModel):
    exercise_id: str
    exercise_name: str
    max_weight: Decimal
    max_reps: int


# ---------------------------------------------------------------------------
# Sync schemas
# ---------------------------------------------------------------------------


class SyncSessionData(BaseModel):
    id: str
    template_id: str | None = None
    year_week: str | None = None
    week_type: str
    started_at: datetime
    finished_at: datetime | None = None
    notes: str | None = None


class SyncSetData(BaseModel):
    id: str
    session_id: str
    exercise_id: str
    set_type: str
    set_number: int
    reps: int
    weight: Decimal
    rpe: Decimal | None = None
    notes: str | None = None


class SyncRequest(BaseModel):
    sessions: list[SyncSessionData] = []
    sets: list[SyncSetData] = []


class SyncResponse(BaseModel):
    synced_sessions: list[str] = []
    synced_sets: list[str] = []
    errors: list[str] = []
