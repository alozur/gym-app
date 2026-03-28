from datetime import datetime
from decimal import Decimal

from typing import Literal

from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------


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
    exercise_type: Literal["reps", "timed"] = "reps"


class ExerciseResponse(BaseModel):
    id: str
    name: str
    muscle_group: str
    equipment: str | None = None
    is_custom: bool
    youtube_url: str | None = None
    notes: str | None = None
    exercise_type: str
    created_at: datetime
    substitutions: list[SubstitutionResponse] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Template schemas
# ---------------------------------------------------------------------------


class TemplateExerciseCreate(BaseModel):
    id: str | None = None
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
    warmup_sets: int = Field(..., ge=0, le=4)

    @model_validator(mode="after")
    def validate_rep_range(self) -> "TemplateExerciseCreate":
        if self.min_reps > self.max_reps:
            raise ValueError("min_reps must be <= max_reps")
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
    warmup_sets: int

    model_config = {"from_attributes": True}


class TemplateCreate(BaseModel):
    id: str | None = None
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
    program_id: str | None = None
    phase_workout_id: str | None = None
    user_program_id: str | None = None
    week_type: str = Field(..., min_length=1, max_length=20)
    year_week: str | None = None


class SessionUpdate(BaseModel):
    finished_at: datetime | None = None
    notes: str | None = None


class SessionResponse(BaseModel):
    id: str
    template_id: str | None = None
    program_id: str | None = None
    phase_workout_id: str | None = None
    user_program_id: str | None = None
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
    program_id: str | None = None
    phase_workout_id: str | None = None
    user_program_id: str | None = None
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

    model_config = {"from_attributes": True}


class ProgressDetailResponse(BaseModel):
    id: str
    exercise_id: str
    year_week: str
    max_weight: Decimal
    created_at: datetime

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
    program_id: str | None = None
    phase_workout_id: str | None = None
    user_program_id: str | None = None
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


# ---------------------------------------------------------------------------
# Program schemas
# ---------------------------------------------------------------------------


class ProgramRoutineCreate(BaseModel):
    id: str | None = None
    template_id: str
    order: int = Field(..., ge=0)


class ProgramRoutineResponse(BaseModel):
    id: str
    template_id: str
    template_name: str | None = None
    order: int

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def extract_template_name(cls, data: object) -> object:
        if hasattr(data, "template") and data.template:
            data.template_name = data.template.name
        return data


class ProgramCreate(BaseModel):
    id: str | None = None
    name: str = Field(..., min_length=1, max_length=200)
    deload_every_n_weeks: int = Field(default=6, ge=1, le=52)
    routines: list[ProgramRoutineCreate] = []


class ProgramResponse(BaseModel):
    id: str
    user_id: str | None = None
    name: str
    program_type: str = "rotating"
    deload_every_n_weeks: int
    is_shared: bool = False
    created_at: datetime
    routine_count: int = 0

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def compute_fields(cls, data: object) -> object:
        if hasattr(data, "routines"):
            data.routine_count = len(data.routines)
        if hasattr(data, "user_id"):
            data.is_shared = data.user_id is None
        return data


class ProgramDetailResponse(BaseModel):
    id: str
    user_id: str | None = None
    name: str
    program_type: str = "rotating"
    deload_every_n_weeks: int
    is_shared: bool = False
    created_at: datetime
    routine_count: int = 0
    routines: list[ProgramRoutineResponse] = []

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def compute_fields(cls, data: object) -> object:
        if hasattr(data, "routines"):
            data.routine_count = len(data.routines)
        if hasattr(data, "user_id"):
            data.is_shared = data.user_id is None
        return data


class UserProgramResponse(BaseModel):
    id: str
    user_id: str
    program_id: str
    program_name: str | None = None
    program_type: str | None = None
    deload_every_n_weeks: int | None = None
    is_active: bool
    started_at: datetime | None = None
    current_routine_index: int
    current_phase_index: int = 0
    current_week_in_phase: int = 0
    current_day_index: int = 0
    weeks_completed: int
    last_workout_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def extract_program_info(cls, data: object) -> object:
        if hasattr(data, "program") and data.program:
            data.program_name = data.program.name
            data.program_type = data.program.program_type
            data.deload_every_n_weeks = data.program.deload_every_n_weeks
        return data


class TodayResponse(BaseModel):
    program: ProgramResponse
    user_program: UserProgramResponse
    current_routine: ProgramRoutineResponse | None = None
    template_name: str | None = None
    template_exercises: list[TemplateExerciseResponse] = []
    week_type: str
    week_number: int
    is_deload: bool
    next_routine_name: str | None = None


# ---------------------------------------------------------------------------
# Phased program schemas
# ---------------------------------------------------------------------------


class PhaseWorkoutExerciseResponse(BaseModel):
    id: str
    exercise_id: str
    exercise_name: str | None = None
    order: int
    working_sets: int
    reps_display: str
    rest_period: str | None = None
    intensity_technique: str | None = None
    warmup_sets: int
    notes: str | None = None
    substitute1_exercise_id: str | None = None
    substitute1_exercise_name: str | None = None
    substitute2_exercise_id: str | None = None
    substitute2_exercise_name: str | None = None

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def extract_names(cls, data: object) -> object:
        if hasattr(data, "exercise") and data.exercise:
            data.exercise_name = data.exercise.name
        if hasattr(data, "substitute1") and data.substitute1:
            data.substitute1_exercise_name = data.substitute1.name
        if hasattr(data, "substitute2") and data.substitute2:
            data.substitute2_exercise_name = data.substitute2.name
        return data


class PhaseWorkoutSectionResponse(BaseModel):
    id: str
    name: str
    order: int
    notes: str | None = None
    exercises: list[PhaseWorkoutExerciseResponse] = []

    model_config = {"from_attributes": True}


class PhaseWorkoutResponse(BaseModel):
    id: str
    name: str
    day_index: int
    week_number: int
    sections: list[PhaseWorkoutSectionResponse] = []

    model_config = {"from_attributes": True}


class ProgramPhaseResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    order: int
    duration_weeks: int

    model_config = {"from_attributes": True}


class ProgramPhaseDetailResponse(ProgramPhaseResponse):
    workouts: list[PhaseWorkoutResponse] = []


class PhasedTodayResponse(BaseModel):
    program: ProgramResponse
    user_program: UserProgramResponse
    phase: ProgramPhaseResponse
    workout: PhaseWorkoutResponse
    phase_number: int
    week_in_phase: int
    day_number: int
    total_phases: int
